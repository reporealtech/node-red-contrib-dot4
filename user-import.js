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
		  // , reloginTimeout: 1000 * 60 * 60 * 8 // 8h
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

				const userManagementApi=await dot4Client.createUserManagementApi()
				, successfullyImportedUsers=[]
				, preScriptUsers=await userManagementApi.loadAllUsers()
				, existingDepartments=await userManagementApi.loadAllDepartments()
				, existingCompanies=await userManagementApi.loadAllCompanies()
				;
				// node.log(JSON.stringify(existingCompanies))

				let uploadArray=msg.payload
				, uploadError
				;
				
				if(_.get(config,"format")=="activeDirectory") {
					if(_.get(msg,"payload.users"))
						uploadArray=msg.payload.users
					uploadArray=_.sortBy(uploadArray, ['sn', 'givenName']);
				}
				
				if(!_.isArray(uploadArray))
					uploadArray=[uploadArray];
				
				//upload users
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
						
						//Custom Properties
						_.forEach(userParams, (v,k)=>{
							let k_PERS=k;
							if(!k_PERS.endsWith("_PERS"))
								k_PERS+='_PERS';
							// node.log(`set ${k_PERS}`)
							dot4user[k_PERS]=v;
						})
						
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
					
					//set company and department
					if(userParams.company){
						let company=_.find(existingCompanies, {name: userParams.company})
						
						if(!company && !dot4user.isDeactivated && !dot4user.isDeactivated_PERS ){
							company=await userManagementApi.createCompany({name: userParams.company});
							existingCompanies.push(company);
						}
						
						if(company) {
							dot4user.company_PERS=company.id;
							
							if(userParams.department){
								let department=_.find(existingDepartments, {name: userParams.department, company_DEPA: company.id})
								
								if(!department && !dot4user.isDeactivated && !dot4user.isDeactivated_PERS ){
									department=await userManagementApi.createDepartment({name: userParams.department, company_DEPA: company.id});
									existingDepartments.push(department);
								}
								
								if(department) {
									dot4user.department_PERS=department.id;
								} else {
									node.log(`cannot set department [${userParams.department}] at user [${dot4user.firstName} ${dot4user.lastName}]`)
								}
							}
						} else {
							node.log(`cannot set company [${userParams.company}] at user [${dot4user.firstName} ${dot4user.lastName}]`)
						}
					}
					
					node.log(`uploading/updating in dot4: ${dot4user.firstName} ${dot4user.lastName}`);

					// node.log("----------userImport: "+JSON.stringify(dot4user))
					node.status({fill:"blue",shape:"ring",text:`processing ${dot4user.lastName}`});
					let uploadResult=await userManagementApi.upsertPerson(dot4user);
					if(uploadResult instanceof Error) {
						uploadError=uploadResult.message
						node.log(uploadError)
					} else if(uploadResult){
						// node.log('uploadResult: '+JSON.stringify(uploadResult))
						successfullyImportedUsers.push({userParams, uploadResult})
					}
				}
				
				//set supervisor relations
				let supervisorAttrName=_.get(config,"supervisor_attr_name") || 'supervisor' 
				, supervisorAttrRef=_.get(config,"supervisor_attr_refname") || 'email' 
				if(_.get(config,"format")=="activeDirectory") {
					supervisorAttrName="manager"
					supervisorAttrRef="distinguishedName"
				}
				
				//filter for users who have a supervisor
				for(const uploaded of _.filter(successfullyImportedUsers, s=>_.get(s,"userParams."+supervisorAttrName) )){
					let supervisor=_.get(_.find(successfullyImportedUsers, o=>o.userParams[supervisorAttrRef]==uploaded.userParams[supervisorAttrName]), 'uploadResult')
						|| _.find(preScriptUsers, o=>o[supervisorAttrRef]==uploaded.userParams[supervisorAttrName] || o[supervisorAttrRef+'_PERS']==uploaded.userParams[supervisorAttrName])
					;
					// node.log(JSON.stringify(uploaded))
					if(supervisor){
						uploaded.uploadResult.supervisor_PERS = supervisor.id
					} else {
						node.log("cannot find supervisor object")
						continue
					}
					// node.log("---------------------")
					let uploadResult=await userManagementApi.updatePerson(uploaded.uploadResult);
					if(uploadResult instanceof Error) 
						node.log(uploadResult.message)
				
				}
				
				msg.payload=`imported ${successfullyImportedUsers.length}/${uploadArray.length} user(s) into dot4`
				node.log(msg.payload)
				node.send(msg);
				
				if( successfullyImportedUsers.length == uploadArray.length)
					node.status({fill:"green",shape:"dot",text:"finished"});
				else
					node.status({fill:"red",shape:"dot",text: uploadError || "finished with error(s)"});
			} catch(e) {
				node.log("ERROR: "+e)
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