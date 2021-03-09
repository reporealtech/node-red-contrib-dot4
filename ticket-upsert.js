/**
 * @copyright Copyright (C) REALTECH AG, Germany - All Rights Reserved
 *  Unauthorized copying of this file, via any medium is strictly prohibited
 *  Proprietary and confidential
 *  Written by Tobias Ceska <tobias.ceska@realtech.com>, December 2019
 */

"use strict";

const _=require("lodash")

, createDot4Client = require('dot4-api-client')
;


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
			  , proxy: {
				  url: dot4ConfigNode.proxyurl
				  , username: dot4ConfigNode.proxyusername
				  , password: _.get(dot4ConfigNode,"credentials.proxypassword")
			  }
			}
			;
			
			let dot4Client
			, incidentManagementApi
			, ticketCiTypeId
			;

			node.on('input', async function(msg) {
				try{

					if(!dot4Client || !incidentManagementApi) {
						node.log(`createDot4Client. baseUrl: ${dot4config.baseUrl}, user: ${dot4config.user}, tenant: ${dot4config.tenant}, proxy: ${JSON.stringify(dot4config.proxy)}`)
						node.status({fill:"green",shape:"ring",text:"connecting"});
						dot4Client = createDot4Client(dot4config);
						await dot4Client.connect();
						node.log("connected to dot4")
				
						incidentManagementApi=await dot4Client.createIncidentManagementApi()
						ticketCiTypeId=_.get(incidentManagementApi.getCiType(incidentManagementApi.getUuidCiTypeIncident()),'id')
					}
					
					node.status({fill:"blue",shape:"ring",text:"uploading ticket"});

					let ticketsParam=msg.payload
					if(!_.isArray(ticketsParam)){
						ticketsParam=[msg.payload]
					}
					
					let externalIdMapper={}
					, checkedExternalIds=[]
					;
					for(const t of ticketsParam){
						for(const k of _.keys(t)) {
							if(k!="dot4_id" && k.endsWith('_id') && checkedExternalIds.indexOf(k)==-1){
								node.log("#found external ID: "+k)
								let attrType=await incidentManagementApi.createOrActivateCiAttributeTypeIfNeeded('INC', k)
								externalIdMapper[k]=attrType.propertyName
								checkedExternalIds.push(k)
							}
						}
					}
					
					let feedbackCnt=0
					, resultArray=[]
					for(const incident of ticketsParam){
						node.status({fill:"blue",shape:"ring",text:`uploading ticket (${++feedbackCnt}/${ticketsParam.length})`});
						
						//fuer Ticket Upload werden INC Endungen benoetigt
						_.forEach(externalIdMapper, (externalId_INC,externalId)=>{
							incident[externalId_INC]=incident[externalId]+''
							delete incident[externalId]
						})

						if(!incident.dot4_id ){
							//suche, ob eindeutige fremd-IDs gesetzt sind und es ein CI dazu gibt 
							const used_externalId_names = _.filter(externalIdMapper, (externalId_INC,externalId)=>{
								if(_.get( incident, externalId_INC+".length")){
									node.log(`#found external ID in object [${incident.name}]: ${externalId_INC}=${incident[externalId_INC]}. LENGTH: ${_.get( incident, externalId_INC+".length")}`)
									return true;
								}
							})
							
							if(used_externalId_names.length){
								let keyToCheck=used_externalId_names[0]
								node.log(`-----------keyToCheck: incident["${keyToCheck}"]=${incident[keyToCheck]}`)
									
								// ciQuery = `(ciTypeId eq ${ciTypeId} and (${query}))`;
								const existingDot4Elem = _.get(await incidentManagementApi.getCis(
									`ciTypeId eq ${ticketCiTypeId} and ${keyToCheck} eq ${incident[keyToCheck]}`
								), 'items[0]')
								node.log(`existingDot4Elem: ${JSON.stringify(existingDot4Elem)}`)
								if(existingDot4Elem){
									incident.dot4_id = existingDot4Elem.id
								}
							}
						}
						
						let uploadRes;
						if(incident.dot4_id ){
							incident.id=incident.dot4_id
							// incident.ciTypeId=ticketCiTypeId
						
							node.log(`###update CI  with id [${incident.id}], named [${incident.name}]`)
							if(incident.ciTypeId)
								uploadRes=await incidentManagementApi.updateCi(incident, false)
							else
								uploadRes=await incidentManagementApi.updateIncident(incident)
							// node.log(JSON.stringify(uploadRes))
						} else {
							node.log('###create '+incident.name)
							delete incident.id
							uploadRes = await incidentManagementApi.createIncident(incident);	
							incident.dot4_id=uploadRes.id
						}
						
						//bei msg.payload werden keine INC Endungen erwartet
						_.forEach(externalIdMapper, (externalId_INC,externalId)=>{
							incident[externalId]=incident[externalId_INC]
							delete incident[externalId_INC]
						})
						resultArray.push(uploadRes)
					}
					
					if(_.isArray(msg.payload)){
						msg.payload=resultArray
					} else {
						msg.payload=_.first(resultArray)
					}
					node.send(msg);
					node.log(JSON.stringify(msg.payload))
					node.status({fill:"green",shape:"dot",text:"finished"});
				} catch(e) {
					node.log("ERROR: "+e)
					node.status({fill:"red",shape:"dot",text:`${e}`});
					msg.payload=`${e}`
					node.send(msg)
				}
			});
		}
	}
    RED.nodes.registerType("ticket-upsert",ticketUpsert);
}