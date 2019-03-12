"use strict";

const _=require("lodash")

, createDot4Client = require('dot4-api-client')
;

let dot4Client;

module.exports = function(RED) {
    function ticketExport(config) {

        RED.nodes.createNode(this,config)
        const node = this;

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

				node.log(JSON.stringify(dot4config))
				node.log(`createDot4Client. user: ${dot4config.user}, tenant: ${dot4config.tenant}`)
				node.status({fill:"green",shape:"ring",text:"connecting"});
				dot4Client = createDot4Client(dot4config);
				await dot4Client.connect();
				node.log("connected to dot4")

				node.status({fill:"blue",shape:"ring",text:"loading ticket data"});
				const incidentManagementApi=await dot4Client.createIncidentManagementApi();
				msg.payload = await incidentManagementApi.getIncidents();	
				node.log(`loaded ${msg.payload.length} tickets in dot4`)
				
				node.send(msg);
				node.log(msg.payload)
				node.status({fill:"green",shape:"dot",text:"finished"});
			} catch(e) {
				node.status({fill:"red",shape:"dot",text:"error"});
			}
        });
    }
    RED.nodes.registerType("ticket-export",ticketExport,{
		credentials: {
		  username: {type:"text"},
		  password: {type:"password"}
		}
	});
}