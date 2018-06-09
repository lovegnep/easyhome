**A tcp proxy tool**
---
> this tool is written with nodejs, it contains a client and a server. The server play a role of proxy server. The client transfer data from local area network to the proxy server. And by this other client out of the local area network can access the service in the area network.

**How to use**
---
For example, a service runs on port 3389(as you know, it is the remote desktop port for windows) in local area network, and you have a vps with the ip 39.189.54.122. So you can connect the port 3389 in the local area network by follow steps:

1. download the project to your vps, and type follows:


    	npm install log4js

    	node server.js


2. download the project to the pc in the local area network, and type follows:


    	npm install log4js

    	node client.js


3. you can control the pc in the local area network by any other pc with the addr:39.189.54.122:3389

**tips**
---
If you want connect other port in LAN, just edit the *config.js*, and if you want connect other ip address in LAN, just edit the *localAddr of client.js*


**How did it work**
---
comming soon...