"use strict";

const _=require("lodash")

, createDot4Client = require('dot4-api-client')
;

let dot4Client;

module.exports = function(RED) {
    function ticketUpsert(config) {

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

					let ticketsParam=msg.payload
					if(!_.isArray(ticketsParam)){
						ticketsParam=[msg.payload]
					}
					
					//find new _id, e.g. tfs_id or sd_id
					// node.log(JSON.stringify(existingCiAttributeTypesForTickets))
					let externalIdMapper={}
					// , externalId_INC
					;
					for(const k of _.keys(_.first(ticketsParam))) {
						if(k!="dot4_id" && k.endsWith('_id')){
							node.log("#found external ID: "+k)
							// externalId=k
							
							let attrType=await incidentManagementApi.createOrActivateCiAttributeTypeIfNeeded('INC', k)
							// externalId_INC=attrType.propertyName
							externalIdMapper[k]=attrType.propertyName
						}
					}
					
					for(const incident of ticketsParam){
						
						//fuer Ticket Upload werden INC Endungen benoetigt
						_.forEach(externalIdMapper, (externalId_INC,externalId)=>{
							// node.log('######################## '+externalId_INC+', '+externalId)
							incident[externalId_INC]=incident[externalId]+''
							delete incident[externalId]
						})

						if(incident.dot4_id){
							incident.id=incident.dot4_id;
						
							node.log('###update '+incident.name)
							await incidentManagementApi.updateCi(incident)
						} else {
							node.log('###create '+incident.name)
							delete incident.id
							const createdIncident = await incidentManagementApi.createIncident(incident);	
							incident.dot4_id=createdIncident.id
						}
						
						//bei msg.payload werden keine INC Endungen erwartet
						_.forEach(externalIdMapper, (externalId_INC,externalId)=>{
							incident[externalId]=incident[externalId_INC]
							delete incident[externalId_INC]
						})

					}
					
					msg.payload=ticketsParam;
					node.send(msg);
					node.log(JSON.stringify(msg.payload))
					node.status({fill:"green",shape:"dot",text:"finished"});
				} catch(e) {
					node.log("ERROR: "+e)
					node.status({fill:"red",shape:"dot",text:`${e}`});
				}
			});
		}
	}
    RED.nodes.registerType("ticket-upsert",ticketUpsert);
}