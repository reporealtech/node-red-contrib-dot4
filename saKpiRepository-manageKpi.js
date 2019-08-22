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

					let action=_.get(msg,"payload.action") || "read"
					, kpi=_.get(msg,"payload.kpi")
					, result
					, resultColor="green"
					;
					if(_.get(kpi,"name")){
						const kpis=await repoCli.getAllKpis()
						, kpiInDB=_.find(kpis,kdb=>kdb.name==kpi.name || kdb.uid==kpi.name)
						;
						// node.log(`kpiInDB: ${JSON.stringify(kpiInDB)}`)
						
						if(action=="create"){
							result=await repoCli.defineCustomKpi(kpi)
						} else if(action=="update"){
							if(kpiInDB){
								await repoCli.deleteKpi(_.get(kpiInDB,"uid"))
								result=await repoCli.defineCustomKpi(kpi)
							} else {
								result="no kpi found to update"
								resultColor="red"
							}
						} else if(action=="delete"){
							if(kpiInDB){
								result=await repoCli.deleteKpi(_.get(kpiInDB,"uid"))
							} else {
								result="no kpi found to delete"
								resultColor="red"
							}
						} else { //read as default
							action="read"
							result=kpiInDB || "no kpi found"
						}
						msg.payload = { action, result }
						node.status({fill:resultColor,shape:"dot",text:"finished"});
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