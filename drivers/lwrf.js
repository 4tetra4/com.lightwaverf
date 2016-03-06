var clone = require('clone');
var deviceList = [];
var tempdata = {};
var LastRX = {};
var signal;
var initFlag = 1;
var pauseSpeed 	= 500;
var lastMessage = '';
var timeoutPeriod =500;
var incomingtimeoutflag = true;
var inmessageQ = [];
var incomingQueTimer;
var lastTXMessageID;

function createDriver(driver) {
	var self = 
		{
			init: function( devices, callback ) 
			{
				//Define signal
				if(initFlag)
					{
					console.log('LightwaveRF: Init')
					
					
					
					
					
					initFlag = 0;
					var Signal = Homey.wireless('433').Signal;
					var high1 =300;	//orginal 293	14-15 samples at 48khz				
					var high2 =300;	//orginal 280  14-15 samples at 48khz
					var low1 = 1350;	//orginal 1273  65 samples at 48khz
					signal = new Signal(
						{   
						sof: [high1,high2], //Start of frame,Starting 1 added to words due to some starting words beginning on a low
   						eof: [high1], //high1,  End of frame,Ending 1 added to words due to some ending words ending on a low
						words: [
							[high1,high2,	high1,high2,  	high1,high2,		high1,high2,		high1,			low1,  			high1,high2,		high1,			low1],// 0x0	1+11110110
							[high1,high2,  	high1,high2,		high1,high2,  	high1,			low1,			high1,high2,  	high1,high2,		high1,			low1],// 0x1	1+11101110
							[high1,high2,  	high1,high2,		high1,high2,  	high1,			low1,			high1,high2,  	high1,			low1,			high1,high2],// 0x2	1+11101101
							[high1,high2,  	high1,high2,		high1,high2,  	high1,			low1,			high1,			low1,  			high1,high2,  	high1,high2],// 0x3	1+11101011
							[high1,high2,  	high1,high2,		high1,			low1,  			high1,high2,		high1,high2,  	high1,high2,		high1,			low1],// 0x4	1+11011110
							[high1,high2,  	high1,high2,		high1,			low1,  			high1,high2,		high1,high2,  	high1,			low1,			high1,high2],// 0x5	1+11011101
							[high1,high2,  	high1,high2,		high1,			low1,  			high1,high2,		high1,			low1,  			high1,high2,  	high1,high2],// 0x6	1+11011011
							[high1,high2,	high1,			low1,			high1,high2,		high1,high2,		high1,high2,		high1,high2,		high1,			low1],	// 0x7 1+10111110
							[high1,high2,	high1,			low1, 			high1,high2,		high1,high2,		high1,high2,		high1,			low1,			high1,high2],// 0x8 1+10111101
							[high1,high2,	high1,			low1,			high1,high2,		high1,high2,		high1,			low1,			high1,high2,		high1,high2],// 0x9	1+10111011
							[high1,high2,	high1,			low1,			high1,high2,		high1,			low1,			high1,high2,		high1,high2,		high1,high2],// 0xA	1+10110111
							[high1,			low1,			high1,high2,		high1,high2,		high1,high2,		high1,high2,		high1,high2,		high1,			low1],// 0xB	1+01111110
							[high1,			low1,			high1,high2,		high1,high2,		high1,high2,		high1,high2,		high1,			low1,			high1,high2],// 0xC	1+01111101
							[high1,			low1,			high1,high2,		high1,high2,		high1,high2,		high1,			low1,			high1,high2,		high1,high2],// 0xD	1+01111011
							[high1,			low1,			high1,high2,		high1,high2,		high1,			low1,			high1,high2,		high1,high2,		high1,high2],// 0xE	1+01110111
							[high1,			low1,			high1,high2,		high1,			low1,			high1,high2,		high1,high2,		high1,high2,		high1,high2],// 0xF	1+01101111
							],
						interval: 10750, 	//Time between repetitions,  this is the time between the a complete message and the start of the next
						repetitions: 4,   	
						//This is the trigger count for detecting a signal,, this may also be the number of times a transmition takes place
						//basic remotes send the whole message 6 times, while the wifilink sends this 25 time
						sensitivity: 0.8, 
						minimalLength: 10,
                    	maximalLength: 10
						});
					
						
						signal.register(function( err, success ){
							if(err != null)
								{
								console.log('LightwaveRF: err', err, 'success', success);
								}
						});
							
							
						console.log('Start listening for Lightwave Commands');
					
						//Start receiving
						signal.on('payload', function(payload, first)
							{
							//should prevent boucing, but need dim value therefore used alternative method
							 //if(!first)return;
			
							//Convert received array to usable data
							var rxData = parseRXData(payload); 
							
							//console.log('RXdata at first point of recieve:', rxData);
							
							ManageIncomingRX(self, rxData)
							
						});
					}
							
			//Refresh deviceList
			devices.forEach(function(device)
				{
				console.log('Refresh Device List TransID', device.transID, ' Driver:', device.driver);
				addDevice(device);
				});
				callback();
			},//end if init
		

			deleted: function( device_data ) 
			{
				var index = deviceList.indexOf(getDeviceById(device_data));
				delete deviceList[index];
				//console.log('LW item: Device deleted, you will need to manually remove homey from the device');
			},//end of deleted
		
			capabilities: {
						onoff: {
							get: function( device_data, callback ) 
								{
									//console.log('capabilities get onoff');
									var device = getDeviceById(device_data);
									callback( null, device.onoff );
								},
							set: function( device_data, onoff, callback ) 
								{
									///console.log('Setting device');
							
									var devices = getDeviceByEachtransID(device_data);
									
									devices.forEach(function(device){
										updateDeviceOnOff(self, device, onoff);
									});	
	
									sendOnOff(device_data, onoff);
									callback( null, onoff );
								}
						},
					dim: {
						get: function( device_data, callback )
							{
								//console.log('capabilities get dim');
								
								var device = getDeviceById(device_data);
								
								// Changing dim State turns on Lights but does not change light state
								callback( null, device.dim ); //New state
								
								
							},
		
						set: function( device_data, dim, callback )
							{
								//console.log('capabilities set dim', device_data);
								setDim(device_data, dim, function(err, dimLevel) 
									{
										Homey.log('Set dim:', dimLevel);
										//module.exports.realtime( device, 'dim', dimLevel );
										
										////%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
										
										
										//var device = getDeviceById(device_data);
										//updateDeviceDim(self, device, dim);
										
										callback( null, dimLevel ) //New state
									});		
							}
						}		
		}, 
	
		
		pair: function( socket ) {
			//console.log('pair socket at ',displayTime());
			//This is the first call to set temp data for a socket
			socket.on('imitate1', function( data, callback )
				{
					//console.log('imitate1 at ',displayTime());
					var address = [];
					for(var i = 0; i < 20; i++)
						{
							address.push(Math.round(Math.random()));
						}	
					address = bitArrayToString(address);
					var transID1 = getRandomInt(0,15);
					var transID2 = getRandomInt(0,15);
					var transID3 = getRandomInt(0,15);
					var transID4 = getRandomInt(0,15);
					var transID5 = getRandomInt(0,15);
					console.log('pair about to add');
					var dim = 1;
				
				var transID = HextoTransID(transID1, transID2, transID3, transID4, transID5);
				
				tempdata = 
					{
					address: address,
					transID    : transID,
					transID1   : transID1,
					transID2   : transID2,
					transID3   : transID3,
					transID4   : transID4,
					transID5   : transID5,
					dim		   : dim,
					onoff  	   : true,
					}	
				//console.log('Data in Tempdata',tempdata);
			
				sendOnOff(tempdata, true);
				socket.emit('datasent');
				callback();
			});
			
	
			///????????
			//This is continuing to run after the pairing is closed
			///????????
			
			//Testing of Remote
			socket.on('test_device', function( data, callback ){
				
				signal.on('payload', function(payload, first){
					console.log('test device - payload recieved ',displayTime());
					
					if(!first)return;
			        var rxData = parseRXData(payload);
					
				
			        if(rxData.transID == tempdata.transID){
						if(rxData.onoff){
							socket.emit('received_on'); //Send signal to frontend
						}else{
							socket.emit('received_off'); //Send signal to frontend
						}
					}
				});
				callback(null, tempdata.onoff);
			});
			
			
			//Testing of Remote
			socket.on('test_device_pir', function( data, callback ){
				//console.log('test device pir at ',displayTime());
				signal.on('payload', function(payload, first){
					//console.log('test device pir- payload recieved ',displayTime());
					
					if(!first)return;
			        var rxData = parseRXData(payload);
					
					//console.log('rxData.transID',rxData.transID);
					//console.log('tempdata.transID)',tempdata.transID);
					
					
			        if(rxData.transID == tempdata.transID){
						if(rxData.command = 9){
							socket.emit('received_on'); //Send signal to frontend
						}else{
							socket.emit('received_off'); //Send signal to frontend
						}
					}
				});
				callback(null, tempdata.onoff);
			});
			
			
			
			
						
			//Testing of Remote
			socket.on('remote', function( data, callback )
				{
				//console.log('remote socket at ',displayTime());
					signal.once('payload', function(payload, first)
						{
							//console.log('remote payload at ',displayTime());
							if(!first)return;
							//console.log('Remote Detected at ',displayTime());
							
							
			        		var rxData = parseRXData(payload);
							
							//added for remote
							var address = [];
							for(var i = 0; i < 20; i++)
								{
									address.push(Math.round(Math.random()));
								}	
							address = bitArrayToString(address);
							
							tempdata = 
								{
								address		: address,
								transID    	: rxData.transID,
								transID1   	: rxData.transID1,
								transID2   	: rxData.transID2,
								transID3   	: rxData.transID3,
								transID4   	: rxData.transID4,
								transID5   	: rxData.transID5,
								dim		   	: rxData.dim,
								onoff  	   	: rxData.onoff,
								}		
							console.log('Trans ID ',rxData.transID);
							console.log('Trans ID ',rxData.transID1, rxData.transID2, rxData.transID3, rxData.transID4, rxData.transID5);
							
							console.log('Temp Data stored at',displayTime());
							socket.emit('remote_found');
							callback(null, tempdata.onoff);
						});
						
		
					
				});
				
							
			//Testing of remote	
			socket.on('generate', function( data, callback )
				{
					//console.log('generate at ',displayTime());
					signal.on('payload', function(payload, first)
						{
							
							//console.log('generate payload at ',displayTime());
							if(!first)return;
			        		var rxData = parseRXData(payload);
							
							//console.log('tempdata', tempdata);
							
			       			if(rxData.address == tempdata.address ){
							if(rxData.onoff){
								socket.emit('received_on'); //Send signal to frontend
								}else{
								socket.emit('received_off'); //Send signal to frontend
							}
							}
						});
				
					callback(null, tempdata.onoff);
				});// end of socket on
				
		socket.on('saveRemote', function( onoff, callback )
				{
					console.log('SaveRemote at ',displayTime());	
					console.log('No action is taken just flipping of the switch');		
					///added for remote end
					//console.log('tempdata', tempdata);
							
					callback();
				});
				
		//Sending Test Data to Socket or Light		
		socket.on('sendSignal', function( onoff, callback )
				{
					//console.log('SendSignal at ',displayTime());
					if(onoff != true){
						onoff = false;
						}
					sendOnOff(tempdata, onoff);
					var devices = getDeviceByEachtransID(tempdata);
					
					devices.forEach(function(device){
						updateDeviceOnOff(self, device, onoff)
					});	
						
					callback();
				});
				
		socket.on('remote_done', function( data, callback )
				{
					//console.log('Remote Done at ',displayTime());
				});
				
				
							
		socket.on('done', function( data, callback )
				{
					console.log('emit Done at', displayTime());
					var idNumber = Math.round(Math.random() * 0xFFFF);
					var id = tempdata.address;
					var name =  __(driver); //__() Is for translation
					//console.log('adding device in socket on');
					
				
					addDevice({
						id       	: id,
						address  	: tempdata.address,
						transID   	: tempdata.transID,
						transID1   	: tempdata.transID1,
						transID2   	: tempdata.transID2,
						transID3   	: tempdata.transID3,
						transID4   	: tempdata.transID4,
						transID5   	: tempdata.transID5,
						dim			: 0,
						onoff    	: false,
						driver   	: driver,
						});
					//console.log('LWSocket: Added device: ID',id);
				
					//Share data to front end
					callback(null, 
						{
							name: name,
							data: {
								id       	: id,
								address  	: tempdata.address,
								transID   	: tempdata.transID,
								transID1   	: tempdata.transID1,
								transID2   	: tempdata.transID2,
								transID3   	: tempdata.transID3,
								transID4   	: tempdata.transID4,
								transID5   	: tempdata.transID5,
								dim			: 0,
								onoff    	: false,
								driver   	: driver,
								}
						});
				});
		},
	};
	return self;
}





function ManageIncomingRX(self, rxData){
	// if message was the same no action
	// if not the action
	
	
	var devices = getDeviceByEachtransID(rxData);
					
	devices.forEach(function(device){
		
		console.log('*****************Pay load received****************');
		console.log(displayTime());
	
		//console.log('Devices Found:', devices.length);
		//console.log('transID rxdata:', rxData.transID);
		//console.log('transID device:', device.transID);
		
		if (lastTXMessageID != device.transID  && devices.length ==1){
			//Homey.log('New message, taking action');	
			console.log('New message:P1', rxData.para1, 
								' P2:',rxData.para2 ,  
								' Cmd:', rxData.Command,
								' TransID:', rxData.transID);


				
			LastRX = rxData;
			
		
			updateDeviceOnOff(self, device, rxData.onoff);					
			flowselection(device, LastRX);
				
			lastTXMessageID = device.transID;
			
			
			//clears the last value after 2 seconds
			setTimeout(function(){lastTXMessageID =''; }, 2000);
		}else{
			//Act on Dim Value
		}
		
	});
	
	

}


	





function getDeviceByTransId(deviceIn) {
	var matches = deviceList.filter(function(d){
		return d.transID == deviceIn.transID;
	});
	return matches ? matches[0] : null;
}
function getDeviceByEachtransID(deviceIn) {
	var matches = deviceList.filter(function(d){
		return d.transID1 == deviceIn.transID1 && 
			d.transID2 == deviceIn.transID2 && 
			d.transID3 == deviceIn.transID3 && 
			d.transID4 == deviceIn.transID4 && 
			d.transID5 == deviceIn.transID5; 
	});
	return matches ? matches : null;
}

 function callfromreemotesetup()// does it need a call back
{
	//console.log('callfromreemotesetup Done');
	}
	
	
function getDeviceById(deviceIn) {
	var matches = deviceList.filter(function(d){
		return d.id == deviceIn.id;
	});
	return matches ? matches[0] : null;
}

function getDeviceBytransIDAndUnit(deviceIn) {
	var matches = deviceList.filter(function(d){
		return d.transID == deviceIn.transID && d.unit == deviceIn.unit; 
	});
	return matches ? matches : null;
}

function getDeviceByAddress(deviceIn) {
	var matches = deviceList.filter(function(d){
		return d.address == deviceIn.address; 
	});
	return matches ? matches : null;
}

function updateDeviceOnOff(self, device, onoff){
	//console.log('Update device OnOff called', device);
	device.onoff = onoff;
	self.realtime(device, 'onoff', onoff);
}

function updateDeviceDim(self, device, dim){
	//console.log('update device dim called');
	device.dim = dim;
	self.realtime(device, 'dim', dim);
}




function addDevice(deviceIn) {
	//console.log('Adding device - Device Data', deviceIn);
	
	var transID = HextoTransID(deviceIn.transID1,deviceIn.transID2, deviceIn.transID3, deviceIn.transID4, deviceIn.transID5)
	//console.log('Adding device - transID', transID);
	
	deviceList.push({
		id       			: deviceIn.id,
		transID1   			: deviceIn.transID1,
		transID2   			: deviceIn.transID2,
		transID3   			: deviceIn.transID3,
		transID4   			: deviceIn.transID4,
		transID5   			: deviceIn.transID5,
		transID   			: transID,
		TransmitterSubID	: deviceIn.TransmitterSubID,
		dim					: deviceIn.dim,
		onoff    			: deviceIn.onoff,
		driver   			: deviceIn.driver
	});	
}

function sendOnOff(deviceIn, onoff) {
	
	var device = clone(deviceIn);
	
	//Consider the transmitter iD to be unique to every device so as not to run out of devices
	//TransmitterID  = is generated a unique vale at pairing
	//device set to 1
	//SUB ID set to 1
	
	var command =0;
	var transID =0;
	var transID1 =0;
	var transID2 =0;
	var transID3 =0;
	var transID4 =0;
	var transID5 =0;
	
	
	
	//console.log('****************Send on off*****************');
	if(device === undefined)
	{
		console.log('In send on off the device is undefined');
	}
	//console.log('device ID', device.id);
	//console.log('Send On / Off, device:',device);
	
	
		
	if( onoff == false){
		//send off
		command =0;
		//deviceIn.onoff = true; 
	}
	else if(onoff == true){
		//send on
		command =1;
		//deviceIn.onoff = false;
	}
	
	//  should look to get last dim level or dim level from app
	if (device.driver =='lw2101'){
		doorbell(1);
	}else{
	
	
	
	var dataToSend = [ 0, 0, 10, command, device.transID1, device.transID2, device.transID3, device.transID4, device.transID5, 1 ];
	var frame = new Buffer(dataToSend);
	
	console.log('Data to Send', dataToSend);
	
	signal.tx( frame, function( err, result ){
   		if(err != null)console.log('LWSocket: Error:', err);
	});
	}
		//need to make this work to send data back,  call back is in capabilities
		//callback( null, deviceIn.onoff ); //Callback the new dim
}
var myVar;
var myVar1;
function doorbell(onoff){
	console.log('Sound Door Bell');
	var command = 3;
	
	
	//[ 0, 0, 0, 3, 15, 7, 3, 9, 11, 12] 
	// myVar = setTimeout(alertFunc(), 0);
	// myVar1 = setTimeout(alertFunc(), 1900);
	 
	alertFunc();

	
}



function alertFunc() {
	//office light
	//a85d6
    //var dataToSend = [ 0, 0, 10, 1, 10, 8, 5, 13, 6, 1 ];
	var dataToSend = [ 0, 0, 0, 3, 15, 7, 3, 9, 11, 12 ];
	var frame = new Buffer(dataToSend);
	
	console.log('Data to Send', dataToSend);
	
	signal.tx( frame, function( err, result ){
   		if(err != null)console.log('LWSocket: Error:', err);
	});
}






// Get the Dim
function getDim( deviceIn, callback ) {
	//devices.forEach(function(device){ //Loop trough all registered devices

		console.log("GetDim", deviceIn.dim);
		deviceIn.dim = deviceIn.dim;  //temp holder
		//if (active_device.group == device.group) {
			console.log("getDim callback", deviceIn.dim);
			callback( null, deviceIn.dim );
		//}
	//});
}



// Set the Dim
function setDim( deviceIn, dim, callback ) {
	
	console.log("setDim: ", dim);
	
	//Device In does not contain the correct onoff value
	console.log("Device In: ", deviceIn);
	var deviceOnOff = getDeviceById(deviceIn);
	console.log("Device In On Off: ", deviceOnOff.onoff);
	
	
	var last_dim = deviceIn.dim;
	//increase dim Parameter: 11  Parameter1: 15
	// decrease dim Parameter: 10  Parameter1: 0
	var Para1 = 0;
	var Para2 = 0;
	var command =0;
	
			if (dim < 0.05) { //Totally off
				//device.bridge.sendCommands(commands.white.off(device.group));
				Para1 = 0;
				Para2 = 0;
				command = 0;
			} else if (dim > 0.95) { //Totally on
				//device.bridge.sendCommands(commands.white.maxBright(device.group));
				Para1 = 0;
				Para2 = 0;
				command = 1;
			} else {
				
				
				var dim_new = Math.round((dim*31) );
				dim_new= dim_new + 192;
				
			
				//0-32 in hex,  first digit para1 second digit para2
				
				var dArray = createHexString(dim_new);
				
				Para1 = parseInt(dArray[0],16);
				Para2 = parseInt(dArray[1],16);
				command = 1;

				
			}
			
			//only fire if the dim value has changed to prevent over firing
			if ( dim_new != last_dim){
				
			var dataToSend = [ Para1, Para2, 10, command, deviceIn.transID1, deviceIn.transID2, deviceIn.transID3, deviceIn.transID4, deviceIn.transID5, 1 ];
			var frame = new Buffer(dataToSend);
	
			
			
			
			//Trigger to detect if lights are on or offf
			//var device = getDeviceById(device_data);
			if (deviceOnOff.onoff== true)
			{
				signal.tx( frame, function( err, result ){
   				if(err != null)console.log('LWSocket: Error:', err);
				console.log('Light on data sent', dataToSend);
			})
			}
			else if(deviceOnOff.onoff == false)
			{
				console.log('Light off so dim level not transmitted', dataToSend);
				}
	
			
			
	
			deviceIn.dim = dim; //Set the new dim
			//console.log("setState callback", deviceIn.dim);
			callback( null, deviceIn.dim ); //Callback the new dim
	
			}
}

function createTransIDtoInt(Hexs) {
	   console.log("input Hex String", Hexs );	
	   var ns = Hexs.tostring();
	   
	   if (ns.length ==5){
       	var trans1 = Hexs.substring(0,1).tostring();
	   	trans1 =parseInt("0x" + trans1,16);
	   	var trans2 = Hexs.substring(1,2).tostring();
	   	trans2 =parseInt("0x" + trans2,16);
	   	var trans3 = Hexs.substring(2,3).tostring();
	   	trans3 =parseInt("0x" + trans3,16);
	   	var trans4 = Hexs.substring(3,4).tostring();
	   	trans4 =parseInt("0x" + trans4,16);   
       	var trans5 = Hexs.substring(4,5).tostring();
	   	trans5 =parseInt("0x" + trans5,16);
	   
	   	var result = [trans1, trans2, trans3, trans4, trans5];
	   	}
	   else
	   	{
		   var result = [];
	   	}
	   
	
		console.log("Int array", result );	  
		

    return result;
}

function createHexString(intToHexArray) {
 
        var str = intToHexArray.toString(16);

        str = str.length == 1 ? "0" + str : 
              str.length == 2 ? str :
              str.substring(str.length-2, str.length);
			  var result = [str.substring(0, 1), str.substring(1, 2)];
			  
		console.log("input String", intToHexArray );	 	  
		console.log("Hex String", str );	  
		console.log("array 1", str.substring(0, 1) );
	 	console.log("array 2", str.substring(1, 2));
	 
	 	
     	console.log("array 1", result[0] );
	 	console.log("array 2", result[1] );


    return result;
}




///Flow Section*************************************************************************************************************

function flowselection(device,rxData){
	console.log('Flow device Device', device);
	console.log('Flow device RX', rxData);
	
	switch(device.driver) {					
		case 'lw100':
			console.log('Flow Selection lw100');
			console.log('Command', rxData.Command);
			
			if (rxData.Command == 1){
				console.log('Flow lw100 remoteOn');
				Homey.manager('flow').trigger('lw100remoteOn');	
				
			}
			if (rxData.Command == 0){
				console.log('Flow lw100 remoteOff');
				Homey.manager('flow').trigger('lw100remoteOff');	
				
			}
		break;
		
		case 'lw107':
		
			console.log('lw107 case');
			console.log('Command', rxData.Command);
		
			if (rxData.Command == 9){
				Homey.manager('flow').trigger('lw107activate');	
				console.log('lw107activate condition');
				}
			if(rxData.Command == 6){
				Homey.manager('flow').trigger('lw107deactivate');	
				console.log('lw107deactivate condition');
				}
		break;
		
		
		case 'lw200':
		console.log('Flow lw200');
		console.log('Command', rxData.Command);
			if (rxData.Command == 1){
				Homey.manager('flow').trigger('lw200remoteOn');	
				console.log('lw200remoteOn');
			}
			if(rxData.Command == 0){
			
				Homey.manager('flow').trigger('lw200remoteOff');	
				console.log('lw200remoteOff');
			}
		break;		
			
		case 'lw904':
			console.log('Flow lw904');
			console.log('Command', rxData.Command);
			if (rxData.Command == 1){
				Homey.manager('flow').trigger('lw904open');	
				console.log('lw904activate');
			}
			if(rxData.Command == 0){
			
				Homey.manager('flow').trigger('lw904close');	
				console.log('lw200remoteOff');
			}
		break;	
				
		case 'lw2100':
			console.log('Flow lw2100');
			console.log('Command', rxData.Command);
			if (rxData.Command == 1){
				Homey.manager('flow').trigger('lw2100press');	
				console.log('lw2100press');
			}

		break;												
		default: 
			
	}
}


Homey.manager('flow').on('trigger.lw100remoteOn', function( callback, args ){
	
	console.log('lw100remoteOn fired in flow. arg:', args);
		
	if(args.channel == LastRX.channel && args.unit == LastRX.unit && args.device.transID == LastRX.transID){
		console.log('Flow approved');
    	callback( null, true );   	
   }else{
		console.log('Flow canceled -did not cancel the flow');
		//callback( null, false ); 
	}	 
});

Homey.manager('flow').on('trigger.lw100remoteOff', function( callback, args ){
	
	
		
	if(args.channel == LastRX.channel && args.unit == LastRX.unit && args.device.transID == LastRX.transID){
		console.log('lw100remoteOff fired in flow. arg:', args);
		console.log('Flow approved');
    	callback( null, true );   	
   }else{
	   	console.log('lw100remoteOff fired in flow. arg:', args);
		console.log('Flow canceled');
		callback( null, false ); 
	}	 
});




Homey.manager('flow').on('trigger.lw107activate', function( callback, args ){ 
	
	if(args.device.transID == LastRX.transID) {
		console.log('lw107activate fired in flow');
		console.log('Flow approved');
	   	callback( null, true ); 
	}else{
		console.log('lw107 not fired:', args);
		console.log('Flow canceled');
		callback( null, false ); 
	}
	
	});
	

Homey.manager('flow').on('trigger.lw107deactivate', function( callback, args ){ 
	if(args.device.transID == LastRX.transID) {
		console.log('lw107deactivate fired in flow');
		console.log('Flow approved');
	   	callback( null, true );   	
		}else{
		console.log('lw107deactivate not fired:', args);
		console.log('Flow canceled');
		callback( null, false ); 
	}
	});
	
Homey.manager('flow').on('trigger.lw200remoteOn', function( callback, args ){ 
	if(args.device.transID == LastRX.transID) {
		console.log('lw200remoteOn fired in flow');
		console.log('Flow approved');
	   	callback( null, true );   	
		}else{
		console.log('lw200remoteOn not fired:', args);
		console.log('Flow canceled');
		callback( null, false ); 
	}
	});
	
Homey.manager('flow').on('trigger.lw200remoteOff', function( callback, args ){ 
	if(args.device.transID == LastRX.transID) {
		console.log('lw200remoteOff fired in flow');
		console.log('Flow approved');
	   	callback( null, true );   	
		}else{
		console.log('lw200remoteOff not fired:', args);
		console.log('Flow canceled');
		callback( null, false ); 
	}
	});
	
Homey.manager('flow').on('trigger.lw904open', function( callback, args ){ 
	if(args.device.transID == LastRX.transID) {
		console.log('lw904open fired in flow');
		console.log('Flow approved');
	   	callback( null, true );   	
		}else{
		console.log('lw904open not fired:', args);
		console.log('Flow canceled');
		callback( null, false ); 
	}
	});


Homey.manager('flow').on('trigger.lw904close', function( callback, args ){ 
	if(args.device.transID == LastRX.transID) {
		console.log('lw904close fired in flow');
		console.log('Flow approved');
	   	callback( null, true );   	
		}else{
		console.log('lw904close not fired:', args);
		console.log('Flow canceled');
		callback( null, false ); 
	}
	});
/*Homey.manager('flow').on('action.card_id.arg_name.autocomplete', function( callback, args ){
    var items = searchForItemsByName( args.query );
    
    // args can also contain other arguments, so you can specify your autocomplete results
    
    
        example items:
        [
            {
                icon: "https://path.to/icon.png",
                name: 'Item name',
                description: 'Optional description',
                some_value_for_myself: 'that i will recognize when fired, such as an ID'
            },
            {
                ...
            }
        ]
   
    
    callback( null, items ); // err, results
    
});*/

///END Flow Section*************************************************************************************************************







//not sure if temp data exits at this point
//function is not in use
function generatTransID(tempdata) {
			tempdata.transID1 = getRandomInt(0,15);
			tempdata.transID2 = getRandomInt(0,15);
			tempdata.transID3 = getRandomInt(0,15);
			tempdata.transID4 = getRandomInt(0,15);
			tempdata.transID5 = getRandomInt(0,15);	
}



///Receiver Section*************************************************************************************************************




//• 2 Nibbles – 1 byte parameter value (0-255)
//• 1 Nibble device (0-15). 15 reserved for mood control.
//		On remote control devie numbered 1-4 ChannelA , 5-8 Channel B etc,  same device for on and off
//		There is also another set of device numbers shifted when the transmitter ID changes with the Sub iD, this mybe a parsing issue but it does sean to be repeatable

//• 1 Nibble - Command (0-15)
//• 5 Nibbles of Transmitter ID
//• 1 Nibble of Transmitter Sub ID (0-15)


//Command Value Parameter meaning
//Off 0 0-127 Switch a device off param usually 64 (or 0-7 first nibble)
//Off 0 128-159 Set a device level 0-31 (param–128)(or 8-9 first nibble)
//Off 0 160-191 Decrease Brightness(or 10-11 first nibble)
//Off 0 192-255 All off param usually 192 (or 12-15 first nibble)
//On 1 0-31 Switch a device On to last level (or 0-1 first nibble)
//On 1 32-63 Set a device level 0-31 (param–32) (or 2-3 first nibble)
//On 1 64-95 Set a device level 0-31 (param–64) Same effect as 0-31 (or 4-5 first nibble)
//On 1 96-127 Set a device level 0-31 (param–96) Same effect as 0-31 (or 6-7 first nibble)
//On 1 128-159 Set a device level 0-31 (param–128) Same effect as 0-31 (or 8-9 first nibble)
//On 1 160-191 Increase brightness (or 10-11 firest nibble)
//On 1 192-223 Set all to level 0-31 (param–192) (or 12-13 first nibble)
//On 1 224-255 Set all to level 0-31 (param–224) (or 14-15 first nibble)
//Mood 2 130- Start mood n (param–129). (130=Mood1) Device = 15, most liekly moods use the second nibble
//Mood 2 2- Define mood n (param–1). (2=Mood1) Device = 15







function GetChannelandPage(device) {
	var channel;
	var page;
	
	
	//need channel and Unit for remote with multiple buttons
	switch(device) {
    case 0:
        page = 1;
		channel = 1;
        break;
    case 1:
        page = 2;
		channel = 1;
        break;
	case 2:
        page = 3;
		channel = 1;
        break;
	case 3:
        page = 4;
		channel = 1;
        break;
	case 4:
        page = 1;
		channel = 2;
        break;
	case 5:
        page = 2;
		channel = 2;
        break;
	case 6:
        page = 3;
		channel = 2;
        break;
	case 7:
        page = 4;
		channel = 2;
        break;
	case 8:
        page = 1;
		channel = 3;
        break;
	case 9:
        page = 2;
		channel = 3;
        break;
	case 10:
        page = 3;
		channel = 3;
        break;
	case 11:
        page = 4;
		channel = 3;
        break;
	case 12:
        page = 1;
		channel = 4;
        break;
	case 13:
        page = 2;
		channel = 4;
        break;
	case 14:
        page = 3;
		channel = 4;
        break;
	case 15:
        page = 4;
		channel = 4;
        break;

    default: 
		page = 5;
		channel = 5;
}
var Devarr= [channel, page];
return Devarr;
}


function convertItoH(integer) {
    var str = Number(integer).toString(16);
    return str.length == 1 ? "0" + str : str;
};

function HextoTransID(transId1,transId2, transId3, transId4, transId5){
	
	
	var t1 = convertItoH(transId1).substring(1,2);
	var t2 = convertItoH(transId2).substring(1,2);
	var t3 = convertItoH(transId3).substring(1,2);
	var t4 = convertItoH(transId4).substring(1,2);
	var t5 = convertItoH(transId5).substring(1,2);
	
	
    var trans = t1 + t2 + t3 + t4 + t5;
	return trans;
}

function parseRXData(data) {


	console.log('Parse data', data);

	if (data != undefined) {
		var para1 = data[0];
		var para2 = data[1];
		var device = data[2];
		var Command = data[3];





		var TransmitterID = HextoTransID(data[4], 
										data[5],
										data[6],
										data[7],
										data[8]);
	
		var TransmitterSubID = data[9];
		//var TransIDArray = createTransIDtoInt(TransmitterID);
		var Devarr = GetChannelandPage(device);
	
	if(Command == "1")
		{
		//Turn On
		onoff = true;
		}
	else
		{
		//Turn Off
		onoff = false;
		}
	
	return { 
		para1 				: para1,
		para2 				: para2,
		device				: device,
		transID				: TransmitterID,
	 	transID1 			: data[4].toString(),
	 	transID2 			: data[5].toString(),
	 	transID3 			: data[6].toString(),
	 	transID4 			: data[7].toString(),
	 	transID5 			: data[8].toString(),
		TransmitterSubID  	: TransmitterSubID,
		//device   			: device,  doubled
		channel				: Devarr[0].toString(),
		unit				: Devarr[1].toString(),
		Command  			: Command,
		onoff    			: onoff
	};
}}


function dec2bin(dec){
    return (dec >>> 0).toString(2);
}

function binarytoString(str) {
  return str.split(/\s/).map(function (val){
    return String.fromCharCode(parseInt(val, 2));
  }).join("");
}

function bitStringToBitArray(str) {
    var result = [];
    for (var i = 0; i < str.length; i++)
        result.push(str.charAt(i) == 1 ? 1 : 0);
    return result;
};

				

/**
 * Returns a random integer between min (inclusive) and max (inclusive)
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function bitArrayToString(bits) {
    return bits.join("");
};

function numberToBitArray(number, bit_count) {
    var result = [];
    for (var i = 0; i < bit_count; i++)
        result[i] = (number >> i) & 1;
    return result;
};

function displayTime() {
    var str = "";

    var currentTime = new Date()
    var hours = currentTime.getHours()
    var minutes = currentTime.getMinutes()
    var seconds = currentTime.getSeconds()

    if (minutes < 10) {
        minutes = "0" + minutes
    }
    if (seconds < 10) {
        seconds = "0" + seconds
    }
    str += hours + ":" + minutes + ":" + seconds + " ";
    if(hours > 11){
        str += "PM"
    } else {
        str += "AM"
    }
    return str;
}

module.exports = {
	createDriver: createDriver
};