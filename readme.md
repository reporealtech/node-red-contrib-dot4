# Node-RED DOT4 API JavaScript Client Library for Node.js

## Container 

docker run --rm -it -p 1880:1880 -v /srv/node-red-data:/data --name mynodered nodered/node-red-docker

Problem: sehr alte node-version. Nicht kompatibel mit dot4-api-client

/srv/node-red-data$ node-red --userDir /srv/node-red-data
DEBUG=dot4-client nodemon --watch nodes node_modules/node-red/red.js --userDir /srv/node-red-data
DEBUG=dot4-client forever --watch --watchDirectory ./nodes/ node_modules/node-red/red.js --userDir /srv/node-red-data

## Node Modules

Einbindung
* node-red-contrib-dot4-api-client
* dot4-api-client

Registrierung des Moduls
* in .config.json

## LDAP Queries

https://ldapwiki.com/wiki/LDAP%20Query%20Basic%20Examples

mail=*@dot4.de
(objectclass=person)