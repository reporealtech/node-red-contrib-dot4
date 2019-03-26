"use strict";

const _=require("lodash")

, createDot4Client = require('dot4-api-client')
;

let dot4Client;

module.exports = function(RED) {
    function ticketUpdateID(config) {

        RED.nodes.createNode(this,config)
        const node = this
		, dot4ConfigNode = RED.nodes.getNode(config.dot4config);
		
		if(dot4ConfigNode){
			const dot4config = {
			  user: dot4ConfigNode.username
			  , password: _.get(dot4ConfigNode,"credentials.password")
			  , tenant: dot4ConfigNode.tenant
			  , baseUrl: dot4ConfigNode.url
			};

			node.on('input', async function(msg) {
				try{
					node.log(`createDot4Client. baseUrl: ${dot4config.baseUrl}, user: ${dot4config.user}, tenant: ${dot4config.tenant}`)
					node.status({fill:"green",shape:"ring",text:"connecting"});
					dot4Client = createDot4Client(dot4config);
					await dot4Client.connect();
					node.log("connected to dot4")

					node.status({fill:"blue",shape:"ring",text:"loading ticket data"});
					const incidentManagementApi=await dot4Client.createIncidentManagementApi()
					;
					
					//find new _id, e.g. tfs_id or sd_id
					// node.log(JSON.stringify(existingCiAttributeTypesForTickets))
					let externalId
					, externalId_INC
					;
					for(const k of _.keys(_.first(msg.payload))) {
						if(k.endsWith('_id')){
							node.log("#found candidate for external ID: "+k)
							externalId=k
							
							let attrType=await incidentManagementApi.createOrActivateCiAttributeTypeIfNeeded('INC', externalId)
							externalId_INC=attrType.propertyName
						}
					}
					
					if(externalId){
						for(const incident of msg.payload){
							incident[externalId_INC]=incident[externalId]+''
							delete incident[externalId]
							// node.log('### '+JSON.stringify(incident))
							await incidentManagementApi.updateCi(incident)
						}
					}
					node.send(msg);
					// node.log(msg.payload)
					node.status({fill:"green",shape:"dot",text:"finished"});
				} catch(e) {
					node.log("ERROR: "+e)
					node.status({fill:"red",shape:"dot",text:`${e}`});
				}
			});
		}
	}
    RED.nodes.registerType("ticket-update-id",ticketUpdateID);
}