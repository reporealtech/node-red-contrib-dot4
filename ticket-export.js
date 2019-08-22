"use strict";

const _=require("lodash")

, createDot4Client = require('dot4-api-client')
;

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
			  , proxy: {
				  url: dot4ConfigNode.proxyurl
				  , username: dot4ConfigNode.proxyusername
				  , password: _.get(dot4ConfigNode,"credentials.proxypassword")
			  }
			};
			
			let dot4Client
			, incidentManagementApi
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
					}
					
					node.status({fill:"blue",shape:"ring",text:"loading ticket data"});
					const tickets= await incidentManagementApi.getIncidents();	
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
					msg.payload=`${e}`
					node.send(msg)
				}
			});
		}
	}
    RED.nodes.registerType("ticket-export",ticketExport);
}