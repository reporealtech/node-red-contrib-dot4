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
    function ciUpdate(config) {
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

					if(_.get(msg,"payload")) {
						node.status({fill:"blue",shape:"ring",text:"updating CI"});
						
						const ci = await configurationManagementApi.getCi(msg.payload.ciId || msg.payload.id);
						if(msg.payload.technicalName && msg.payload.value){
							_.set(ci, msg.payload.technicalName, msg.payload.value);
						} else {
							_.forEach(msg.payload, (v,k)=>{
								_.set(ci, k, v)
							})
						}
						msg.payload = await configurationManagementApi.updateCi(ci);
						node.log("updated ci")
						node.status({fill:"green",shape:"dot",text:"finished"});
					} else {
						msg.payload="msg.payload must be set."
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
    RED.nodes.registerType("ci-update",ciUpdate);
}