"use strict";

const _=require("lodash")

, createDot4Client = require('dot4-api-client')
;

let dot4Client;

module.exports = function(RED) {
    function userImport(config) {

        RED.nodes.createNode(this,config)
        const node = this;

		// node.log(JSON.stringify(config))
		
		const dot4config = {
		  user: _.get(this,"credentials.username")
		  , password: _.get(this,"credentials.password")
		  , tenant: config.tenant
		  , baseUrl: config.url
		  , reloginTimeout: 1000 * 60 * 60 * 8 // 8h
		};

        node.on('input', async function(msg) {
			try{
				// node.log(JSON.stringify(msg))
				// msg.payload = msg.payload.toLowerCase();

				// node.log(JSON.stringify(dot4config))
				node.log(`createDot4Client. user: ${dot4config.user}, tenant: ${dot4config.tenant}`)
				node.status({fill:"green",shape:"ring",text:"connecting"});
				dot4Client = createDot4Client(dot4config);
				await dot4Client.connect();
				node.log("connected to dot4")

				const userManagementApi=await dot4Client.createUserManagementApi();
				//node.log(JSON.stringify(userManagementApi))

				let uploadArray=msg.payload
				, cnt_successfullyImportedUsers=0
				, uploadResult
				;
				
				if(_.get(config,"format")=="activeDirectory" && _.get(msg,"payload.users")) {
					uploadArray=msg.payload.users
				}
				
				if(!_.isArray(uploadArray))
					uploadArray=[uploadArray];
				
				for(const userParams of uploadArray){
					node.log(JSON.stringify(userParams))
					
					let dot4user;
					
					if(_.get(config,"format")=="activeDirectory") {
						dot4user={
							email: userParams.mail
							, firstName: userParams.givenName
							, lastName: userParams.sn
							, personnelNumber: userParams.employeeID
							, isDeactivated: parseInt(userParams.userAccountControl,10).toString(2).substr(-2).substr(0,1) == '1' //http://www.selfadsi.de/ads-attributes/user-userAccountControl.htm in binaer umwandeln und vorletzte Ziffer holen
							, faxBusiness: userParams.facsimileTelephoneNumber
							, description: userParams.displayName
							, name: userParams.displayName
						}
						if(userParams.telephoneNumber)
							dot4user.telephoneNumbersBusiness=[userParams.telephoneNumber]
						if(userParams.mobile)
							dot4user.mobilePhoneNumbersBusiness=[userParams.mobile]
						
					} else {
						dot4user=userParams
					}
					
					if(!_.get(dot4user,"email") ||!_.get(dot4user,"firstName") ||!_.get(dot4user,"lastName")){
						throw new Error("missing user parameters/mapping")
					}
					
					if(_.get(config,"person_or_user")=="person") {
						dot4user.userId_PERS = null
						dot4user.userExisting_PERS = null
					}
					
					node.log(`uploading/updating in dot4: ${dot4user.firstName} ${dot4user.lastName}`)
					
					node.status({fill:"blue",shape:"ring",text:`uploading ${dot4user.lastName}`});
					uploadResult=await userManagementApi.upsertPerson(dot4user);
					if(uploadResult instanceof Error) {
						node.log(uploadResult.message)
					} else {
						cnt_successfullyImportedUsers++;
					}
				}
				msg.payload=`imported ${cnt_successfullyImportedUsers}/${uploadArray.length} user(s) into dot4`
				node.log(msg.payload)
				node.send(msg);
				
				if( cnt_successfullyImportedUsers == uploadArray.length)
					node.status({fill:"green",shape:"dot",text:"finished"});
				else
					node.status({fill:"red",shape:"dot",text: _.get(uploadResult,"message") || "finished with error(s)"});
			} catch(e) {
				node.status({fill:"red",shape:"dot",text: _.get(e,"message") || "ERROR"});
			}
        });
    }
    RED.nodes.registerType("user-import",userImport,{
		credentials: {
		  username: {type:"text"},
		  password: {type:"password"}
		}
	});
}