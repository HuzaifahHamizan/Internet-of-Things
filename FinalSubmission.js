// Import necessary libraries
var mqtt = require('mqtt') 
const Influx=require('influx');
const mariadb = require('mariadb/callback');
const Math=require('math');
const dbConn = mariadb.createConnection({host: '127.0.0.1', user:'C20373146', password: 'C20373146', database: 'rhealth_C20373146'});

//dbConn.query('CREATE TABLE AliceTracker (customerName varchar(255), numVisit int)', createTableCallback); //This is run only once since a table only needed to be created once*

// MQTT connection options
const options = {
username: 'username', 							   		// MQTT Username
password: 'password', 									// MQTT Password
host: 'host address', 									// MQTT broker host
port: "port number", 									// MQTT broker port
protocol: 'mqtts', 										// MQTT protocol (secure MQTT)	
};

// MQTT client initialization
var mqttClient  = mqtt.connect(options);

// MQTT topics
const topicToSubscribeTo="Receiver"
const topicToPublishTo="Sender"

const customerName = "Alice";

// Constants for BLE device and characteristics
const deviceOfInterest  = 'C8:C6:B0:D8:AA:F1' 										// the Uuid of the device we are looking to connect to

const notifyServiceOfInterestUuid1 = '00000001-0002-0003-0004-000000002000' 		// uuid of button service
const notifyCharacteristicOfInterestUuid1 = '00000001-0002-0003-0004-000000002001' 	// uuid of read/notify characteristic of button A service

var buttonPressCount = 0; 															//counter starts at 0


var actuatorChar;

//MQTT events and handlers
mqttClient.on('connect', connectCallback); 							//when a 'connect' event is received call the connectCallback listener function
        
function connectCallback() {
  console.log("connected to cloud MQTT broker");
  mqttClient.subscribe(topicToSubscribeTo, mqttSubscribeCallback); 	//when connected to the broker, subscribe to messages on the topics specified in the topicToSubscribeTo constant
}

function mqttSubscribeCallback(error, granted) { 
   	if (error) {
		console.log("error subscribing to topic");
	} else {	
		console.log("subscribed to and awaiting messages on topic '" + topicToSubscribeTo + "'");	
    }
}

// Function to handle creating a table in MariaDB
/*function createTableCallback(err, res) {
	if (err) {
      console.log(err.message);
    } else {
	  console.log(res); 
	  dbConn.end();
	}
}*/

const main = async() => {
//async function main () {
  
  const {createBluetooth}=require('node-ble') 							//nodejs ble module/library
  const { bluetooth, destroy } = createBluetooth()

  // get bluetooth adapter
  const adapter = await bluetooth.defaultAdapter() 						//get an available Bluetooth adapter
  await adapter.startDiscovery() 										//using the adapter, start a device discovery session  
  console.log('discovering')
  
  // look for a specific device 
  const device = await adapter.waitDevice(deviceOfInterest)
  console.log('got device', await device.getAddress())					// await device.getAddress())
  console.log('got device remote name', await device.getName())			// await device.getName())
  console.log('got device user friendly name', await device.toString())

  await adapter.stopDiscovery() 
  //connect to the specific device
  await device.connect()
  console.log("connected to device : ")
  
  const gattServer = await device.gatt()
  services = await gattServer.services()
  console.log("services are " + services)
  
 
  if (services.includes(notifyServiceOfInterestUuid1)) { 					//uuid of notify service
	  
	  console.log('got the button service')
	  const primaryNotifyService = await gattServer.getPrimaryService(notifyServiceOfInterestUuid1)
	  const notifyChar = await primaryNotifyService.getCharacteristic(notifyCharacteristicOfInterestUuid1)
	  console.log("characteristic flags are : " + await notifyChar.getFlags())
	  await notifyChar.startNotifications()	  		//register for notification events from the microbit
	  notifyChar.on('valuechanged', buffer => { 	//when a 'valuechanged' event is received from the microbit call the code here (inside the curly brackets)	
	  	++buttonPressCount
	  	Influxlogger();
	  	
	  	if (buttonPressCount % 2 == 0 ) {
			const num = new Date();
			dbConn.query('INSERT INTO AliceTracker (customerName, dateTime) VALUES (?, ?)', [customerName, num])

	  		if (buttonPressCount/2 == 1){
	  			console.log("Button A has been pressed : " + buttonPressCount/2 + " time");
	  			mqttClient.publish(topicToPublishTo, "The button has been pressed " +(buttonPressCount/2).toString() + " time", publishCallback);
	  			}
  			else{  			 
			  	console.log("Button A has been pressed : " + buttonPressCount/2 + " times"); 
			  	//publish the count value to the MQTT broker
			  	mqttClient.publish(topicToPublishTo, "The button has been pressed " +(buttonPressCount/2).toString() + " times", publishCallback);
			  	}
		  } 	//end if		  	
	  })	  

  } 	//end if
 
}

// Function to handle MQTT publishing callback
function publishCallback(error) {     
   	if (error) {
		console.log("error publishing data");
	} else {	 
        console.log("Message is published to topic '" + topicToPublishTo+ "'");
    }
}


// Function to log data to InfluxDB
async function Influxlogger() {
	//const Math=require('math');
	const influx = new Influx.InfluxDB({
		host: 'localhost', //set as local host
		database : 'tshealth_C20373146', //database name
		schema: [
		{
			measurement: 'button', //influx measurement name 
			fields: { x : Influx.FieldType.FLOAT,  //x column type
				},
				tags : ['unit']
		}
		]
	});

	//assigning values in the column
	await influx.writePoints([
	{
		measurement : 'button',
		tags : {
			unit: 'pressed',
		},
		fields : {	x : buttonPressCount/2 //the values assigned into the database is button pressed divided by 1 (since there are 2 actions and we only want one)
		}
	}
	], {
		database: 'tshealth_C20373146',
		precision: 'times',
	}
	)

}


// Execute the main function
main()
  .then()
  .catch(console.error)
