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
			
					node.status({fill:"blue",shape:"ring",text:"uploading ticket"});
					const incidentManagementApi=await dot4Client.createIncidentManagementApi()
					// , existingDot4Incidents=await incidentManagementApi.getIncidents() //TODO: Eigentlich muessen nciht alle geladen werden, sondern nur die mit bestimmten externalId (sd_id, tfs_id, ..)
					;
					
					// node.log(`loaded ${existingDot4Incidents.length} cis in existingDot4Incidents`)
					// node.log(JSON.stringify(_.find(existingDot4Incidents, {id: "3944"})))

					let ticketsParam=msg.payload
					if(!_.isArray(ticketsParam)){
						ticketsParam=[msg.payload]
					}
					
					//find new _id, e.g. tfs_id or sd_id
					// node.log(JSON.stringify(existingCiAttributeTypesForTickets))
					let externalIdMapper={}
					// , externalId_INC
					// , externalId_attrTypeNamesToUpdate=[]
					, checkedExternalIds=[]
					;
					for(const t of ticketsParam){
						for(const k of _.keys(t)) {
							if(k!="dot4_id" && k.endsWith('_id') && checkedExternalIds.indexOf(k)==-1){
								node.log("#found external ID: "+k)
								// externalId=k
								
								let attrType=await incidentManagementApi.createOrActivateCiAttributeTypeIfNeeded('INC', k)
								// externalId_INC=attrType.propertyName
								externalIdMapper[k]=attrType.propertyName
								checkedExternalIds.push(k)
								// if(!attrType.justCreated){ // nur solche, die nicht frisch angelegt wurden?
									// externalId_attrTypeNamesToUpdate.push(attrType.propertyName)
								// }
							}
						}
					}
					
					let feedbackCnt=0
					for(const incident of ticketsParam){
						node.status({fill:"blue",shape:"ring",text:`uploading ticket (${++feedbackCnt}/${ticketsParam.length})`});
						
						//fuer Ticket Upload werden INC Endungen benoetigt
						_.forEach(externalIdMapper, (externalId_INC,externalId)=>{
							// node.log('######################## '+externalId_INC+', '+externalId)
							incident[externalId_INC]=incident[externalId]+''
							delete incident[externalId]
						})

						if(!incident.dot4_id ){
							//suche, ob eindeutige fremd-IDs gesetzt sind und es ein CI dazu gibt 
							// const used_externalId_names = _.filter(externalId_attrTypeNamesToUpdate, (externalId_attrTypeName)=>{
							const used_externalId_names = _.filter(externalIdMapper, (externalId_INC,externalId)=>{
								if(_.get( incident, externalId_INC+".length")){
									node.log(`#found external ID in object [${incident.name}]: ${externalId_INC}=${incident[externalId_INC]}. LENGTH: ${_.get( incident, externalId_INC+".length")}`)
									return true;
								}
							})
							
							if(used_externalId_names.length){
								// node.log(`!!!!LENGTH. used_externalId_names: ${used_externalId_names.length}, existingDot4Incidents: ${existingDot4Incidents.length}`)
								// node.log(`suche nach ${used_externalId_names[0]}.length} in ${JSON.stringify(o)}`)
								let keyToCheck=used_externalId_names[0]
								node.log(`-----------keyToCheck: incident["${keyToCheck}"]=${incident[keyToCheck]}`)
									
							/*	const existingDot4Elem = _.find(existingDot4Incidents, o=>{
									node.log(`check ${o[keyToCheck]}==${incident[keyToCheck]}`)
									if(_.get(o,keyToCheck+".length") && o[keyToCheck]==incident[keyToCheck]){
										node.log(`#found CI for [${incident.name}]`)
										return true;
									}
								})*/
								// ciQuery = `(ciTypeId eq ${ciTypeId} and (${query}))`;
								const existingDot4Elem = _.get(await incidentManagementApi.getCis(
									`ciTypeId eq ${_.get(incidentManagementApi.getCiType(incidentManagementApi.getUuidCiTypeIncident()),'id')} and ${keyToCheck} eq ${incident[keyToCheck]}`
									// "ciTypeId": incidentManagementApi.getCiType(incidentManagementApi.getUuidCiTypeIncident())
									// keyToCheck: incident[keyToCheck]
								), 'items[0]')
								node.log(`existingDot4Elem: ${JSON.stringify(existingDot4Elem)}`)
								if(existingDot4Elem){
									incident.dot4_id = existingDot4Elem.id
								}
							}
						}
													
						if(incident.dot4_id ){
							incident.id=incident.dot4_id;
						
							node.log(`###update CI  with id [${incident.id}], named [${incident.name}]`)
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