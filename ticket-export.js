"use strict";

const _=require("lodash")

, createDot4Client = require('dot4-api-client')
;

let dot4Client;

module.exports = function(RED) {
    function ticketExport(config) {

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
					, tickets= await incidentManagementApi.getIncidents();	
					_.forEach(tickets, t=>{
						_.forEach(t, (v,k)=>{
							if(k.endsWith("_id_INC")){
								t[k.slice(0,-4)]=v
								delete t[k]
							}
						})
						t.dot4_id=t.id
					})
					// node.log('-------------------- '+_.first(tickets))
					msg.payload = tickets
					node.log(`found ${_.get(msg,"payload.length")||0} tickets in dot4`)
					
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
    RED.nodes.registerType("ticket-export",ticketExport);
}