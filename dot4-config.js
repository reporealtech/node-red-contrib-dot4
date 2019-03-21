module.exports = function(RED) {
    function Dot4Config(n) {
        RED.nodes.createNode(this,n);
        this.url = n.url;
        this.tenant = n.tenant;
		this.username = n.username
    }
    RED.nodes.registerType("dot4-config",Dot4Config,{
		credentials: {
		  password: {type:"password"}
		}
	});
}