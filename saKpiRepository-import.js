"use strict";

const _=require("lodash")

, createDot4Client = require('dot4-api-client')
;

module.exports = function(RED) {
    function saKpiRepositoryImport(config) {

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
					// node.status({fill:"green",shape:"ring",text:"connecting"});
					let repoCli = createDot4Client(dot4config).createSaKpiRepositoryClient()

					node.status({fill:"blue",shape:"ring",text:"uploading ticket data"});
					await repoCli.login()
					await repoCli.getAllServices()

					msg.payload="done"
					node.send(msg);
					// node.log(`created ticket "${msg.payload.name}" in dot4`)
					node.status({fill:"green",shape:"dot",text:"finished"});
				} catch(e) {
					node.log("ERROR: "+e)
					node.status({fill:"red",shape:"dot",text:`${e}`});
				}
			});
		}
    }
    RED.nodes.registerType("ticket-create",saKpiRepositoryImport);
}