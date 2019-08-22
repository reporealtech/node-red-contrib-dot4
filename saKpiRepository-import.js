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
			  , saKpiRepository: {
				  url: dot4ConfigNode.sakpirepositoryurl
				  , apiKey: _.get(dot4ConfigNode,"credentials.apikey")
			  }
  			  , proxy: {
				  url: dot4ConfigNode.proxyurl
				  , username: dot4ConfigNode.proxyusername
				  , password: _.get(dot4ConfigNode,"credentials.proxypassword")
			  }
			};
			let repoCli;

			node.on('input', async function(msg) {
				try{
					if(!repoCli){
						node.log(`createDot4Client. baseUrl: ${dot4config.baseUrl}, user: ${dot4config.user}, tenant: ${dot4config.tenant}, proxy: ${JSON.stringify(dot4config.proxy)}`)
					
						node.status({fill:"green",shape:"ring",text:"connecting"});
						repoCli = createDot4Client(dot4config).createSaKpiRepositoryClient()

						await repoCli.login()
					}

					let dataArr=msg.payload
					if(!_.isArray(dataArr))
						dataArr=[msg.payload]
					
					/* consistence check */
					if(!_.every(dataArr, d=>_.has(d,"value")))
						throw new Error(`you must define at least a value for each data row!`);
					
					node.status({fill:"blue",shape:"ring",text:"uploading KPI data"});

					msg.payload=await repoCli.uploadKpis(dataArr, _.get(config,"service"), _.get(config,"kpi"))
					node.send(msg);
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
    RED.nodes.registerType("saKpiRepository-import",saKpiRepositoryImport);
}