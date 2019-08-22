module.exports = function(RED) {
    function Dot4Config(n) {
        RED.nodes.createNode(this,n);
        this.url = n.url;
        this.tenant = n.tenant;
		this.username = n.username
		this.sakpirepositoryurl = n.sakpirepositoryurl
		this.proxyurl = n.proxyurl
		this.proxyusername = n.proxyusername
    }
    RED.nodes.registerType("dot4-config",Dot4Config,{
		credentials: {
		  password: {type:"password"}
		  , apikey: {type:"password"}
		  , proxypassword: {type:"password"}
		}
	});
}