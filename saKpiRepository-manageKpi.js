"use strict";

const _=require("lodash")

, createDot4Client = require('dot4-api-client')
;

module.exports = function(RED) {
    function saKpiRepositoryManageKpi(config) {

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
			};
			let repoCli;

			node.on('input', async function(msg) {
				try{
					if(!repoCli){
						node.log(`createDot4Client. baseUrl: ${dot4config.baseUrl}, user: ${dot4config.user}, tenant: ${dot4config.tenant}`)
					
						node.status({fill:"green",shape:"ring",text:"connecting"});
						repoCli = createDot4Client(dot4config).createSaKpiRepositoryClient()

						await repoCli.login()
					}

					let action=_.get(msg,"payload.action") || "read"
					, kpi=_.get(msg,"payload.kpi")
					;
					if(_.get(kpi,"name")){
						if(action=="create"){
							msg.payload=await repoCli.defineCustomKpi(kpi)
						} else if(action=="update"){
							
						} else if(action=="delete"){
							const kpis=await repoCli.getAllKpis()
							msg.payload=await repoCli.defineCustomKpi(kpi)
						} else { //read as default
							
						}
						node.status({fill:"green",shape:"dot",text:"finished"});
					} else {
						msg.payload="missing parameter: kpi.name"
						node.status({fill:"red",shape:"dot",text:"finished"});
					}
					node.send(msg);
				} catch(e) {
					node.log("ERROR: "+e)
					node.status({fill:"red",shape:"dot",text:`${e}`});
					msg.payload=`${e}`
					node.send(msg)
				}
			});
		}
    }
    RED.nodes.registerType("saKpiRepository-manageKpi",saKpiRepositoryManageKpi);
}