"use strict";

const _=require("lodash")

, createDot4Client = require('dot4-api-client')
;

module.exports = function(RED) {
    function ciSearch(config) {

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
			
			let dot4Client
			, configurationManagementApi
			;

			node.on('input', async function(msg) {
				try{
					
					if(!dot4Client || !configurationManagementApi) {
						node.log(`createDot4Client. baseUrl: ${dot4config.baseUrl}, user: ${dot4config.user}, tenant: ${dot4config.tenant}`)
						node.status({fill:"green",shape:"ring",text:"connecting"});
						dot4Client = createDot4Client(dot4config);
						await dot4Client.connect();
						node.log("connected to dot4")
						configurationManagementApi=await dot4Client.createConfigurationManagementApi()
					}
					
					node.status({fill:"blue",shape:"ring",text:"loading CI data"});
					msg.payload = await configurationManagementApi.getCis(_.get(config,"query"));	
					// node.log('-------------------- '+_.first(tickets))
					node.log(`found ${_.get(msg,"payload.length")||0} cis in dot4`)
					
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
    RED.nodes.registerType("ci-search",ciSearch);
}