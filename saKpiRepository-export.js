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
    function saKpiRepositoryExport(config) {

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

					let service=_.get(msg,"payload.service")||_.get(config,"service")
					
					node.status({fill:"blue",shape:"ring",text:"downloading KPI data"});


					const kpis=_.get(
						await repoCli.downloadKpis(service, _.get(msg,"payload.starttime"), _.get(msg,"payload.endtime"), _.get(msg,"payload.interval"))
						, "[0].kpis"
					)

					if(_.isArray(kpis)){
						msg.payload=[{
							"series": _.map(kpis, 'name'),
							"data": _.map(kpis, k=>{
								return _.map(k.values, v=>{return {x: v.date, y: v.value}})
							}),
							"labels": _.map(kpis, 'label'),
							"colors": _.map(kpis, 'color')
						}]
					} else 
						msg.payload=[]
					
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
    RED.nodes.registerType("saKpiRepository-export",saKpiRepositoryExport);
}