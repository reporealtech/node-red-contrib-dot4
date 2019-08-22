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
			  , proxy: {
				  url: dot4ConfigNode.proxyurl
				  , username: dot4ConfigNode.proxyusername
				  , password: _.get(dot4ConfigNode,"credentials.proxypassword")
			  }
			};
			
			let dot4Client
			, configurationManagementApi
			;

			node.on('input', async function(msg) {
				try{
					
					if(!dot4Client || !configurationManagementApi) {
						node.log(`createDot4Client. baseUrl: ${dot4config.baseUrl}, user: ${dot4config.user}, tenant: ${dot4config.tenant}, proxy: ${JSON.stringify(dot4config.proxy)}`)
						node.status({fill:"green",shape:"ring",text:"connecting"});
						dot4Client = createDot4Client(dot4config);
						await dot4Client.connect();
						node.log("connected to dot4")
						configurationManagementApi=await dot4Client.createConfigurationManagementApi()
					}
					
					if(_.get(msg,"payload.query")){
						node.status({fill:"blue",shape:"ring",text:"loading CI data"});
						msg.payload = await configurationManagementApi.getCis(msg.payload.query);	
						// node.log('-------------------- '+_.first(tickets))
						node.log(`found ${_.get(msg,"payload.items.length")||0} cis in dot4`)
						node.status({fill:"green",shape:"dot",text:"finished"});
					} else {
						msg.payload="msg.payload.query must be set."
						node.status({fill:"red",shape:"dot",text:"finished"});
					}
										
					node.send(msg)
					// node.log(msg.payload)
				} catch(e) {
					node.log("ERROR: "+e)
					node.status({fill:"red",shape:"dot",text:`${e}`});
					msg.payload=`${e}`
					node.send(msg)
				}
			});
		}
	}
    RED.nodes.registerType("ci-search",ciSearch);
}