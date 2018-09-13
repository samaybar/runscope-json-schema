"use strict";

const axios = require('axios');
const log = require("./lib/helpers/logger");
const settings = require('./settings.js');
const jsonSchemaGenerator = require('./lib/json-schema-generator/index');


let {apikey,tests} = settings;
let thisTest = tests[0];
log.debug(thisTest);
let {bucketKey,test_id,test_run_id} = thisTest;
const apiUrl = "https://api.runscope.com";
const authHeader = `Bearer ${apikey}`;
axios.defaults.headers.common['Authorization'] = authHeader;

let jsonArray = [];
let stepDataArray = [];
stepDataArray.push({"stepNumber": 0, "stepType": "initial"});
//log.debug(stepDataArray);
let test
let testResultUrl = `https://api.runscope.com/buckets/${bucketKey}/tests/${test_id}/results/${test_run_id}`;
//log.debug(testResultUrl);

let testDefinitionUrl = `https://api.runscope.com/buckets/${bucketKey}/tests/${test_id}/steps`;
//log.debug(testDefinitionUrl);

function getRunscope(endpointUrl) {
	return axios.get(endpointUrl,);
}

function modifyRunscope(endpointUrl,postData) {
	return axios.put(endpointUrl,postData);
}

async function getTestInfo() {
	try {
		//get the definition of the test
		let thisTestDefinition = await getRunscope(testDefinitionUrl);
		let thisTestDefData = thisTestDefinition.data.data;

		//define step types
		for (let i=1; i<=thisTestDefData.length; i++) {
			stepDataArray.push({"stepNumber": i, "stepType": thisTestDefData[i-1].step_type })
			//stepArray[i].stepType = thisTestDefData[i-1].step_type;
		}
		//log.debug(stepDataArray);
		//get the test result
		let thisTestResult = await getRunscope(testResultUrl);
		let resultData = thisTestResult.data;
		let stepArray = resultData.data.requests;
		//log.debug(stepArray);
		//get step ids from test result
		//let resultSteps = stepArray.map(step => ({stepUuid: step.uuid}));
		let resultStepIds = stepArray.map(step => (step.uuid));

		//log.debug(resultStepIds);
		for (let i=0; i < resultStepIds.length; i++) {
			const thisStepId = resultStepIds[i];
			const thisUrl = `${testResultUrl}/steps/${thisStepId}`
			const thisStepData = await getRunscope(thisUrl);
			const thisStepJson = JSON.parse(thisStepData.data.data.response.body);
			log.debug(`Step ${i}: ${JSON.stringify(thisStepJson)}`);
			
			let schemaObj;
			if (stepDataArray[i].stepType == "request") {
				// log.debug(`Step ${i}`);
				// log.debug(thisStepJson);
				// log.debug(typeof thisStepJson);
				

				schemaObj = jsonSchemaGenerator(thisStepJson);
				

				 log.debug(JSON.stringify(schemaObj,undefined,4));
				// log.debug("************")
				//schemaObj = preventAdditionalProperties(schemaObj);
				stepDataArray[i].schema = schemaObj;
				//stepDataArray[i].schema.additionalProperties =  false;
			} else {
				stepDataArray[i].schema = null;
			}
			stepDataArray[i].json = thisStepJson;
			//log.debug(`Step ${i}: ${stepDataArray[i].json}`);
			// stepDataArray[i].schema = schemaObj;
			// stepDataArray[i].schema.additionalProperties =  false;
			//log.debug(`Step ${i}: ${stepDataArray[i].schema}`);
			stepDataArray[i].uuid = resultStepIds[i];

		}
		//log.debug(stepDataArray);
		//log.debug(`This is the status code: ${results.status}`);
		//log.debug(`This is result: \n${JSON.stringify(thisTestDefData,undefined,4)}`);
		//
		log.debug("get urls");

		for (let i = 0; i < stepDataArray.length; i++) {
			
			if (stepDataArray[i].stepType == "request"){
				let stepUrl = `${testDefinitionUrl}/${stepDataArray[i].uuid}`;
				
				log.debug(stepUrl);
				const thisStep = await getRunscope(stepUrl);
				let thisStepDefinition = thisStep.data.data;
				delete thisStepDefinition.request_id;
				delete thisStepDefinition.id;
				let thisSchema = stepDataArray[i].schema
				let thisStepScript = `var thisSchema = ${JSON.stringify(thisSchema,undefined,4)};\n\nvar data = JSON.parse(response.body);\nassert.jsonSchema(data,thisSchema);`
				thisStepDefinition.scripts.push(thisStepScript);
				stepDataArray[i].definition = thisStepDefinition;
				//log.debug(JSON.stringify(thisStepDefinition,undefined,4));
				try {
					const modifiedStep = await modifyRunscope(stepUrl,thisStepDefinition);
					log.debug(modifiedStep.status);
					log.debug(modifiedStep.data);
				} catch (e) {
					log.warn(e);
				}
			}

		}
		//log.debug(JSON.stringify(stepDataArray,undefined,4));
	} catch (e) {
    	log.warn(e);
  	}
}

getTestInfo();

/*function preventAdditionalProperties(jsonSchema) {
	var thisSchema = jsonSchema;
	var properties = thisSchema.properties;
	log.debug(properties);
	for (let property in properties) {
		log.debug("this is a property");
		log.debug(properties[property]);
	}
}*/

function preventAdditionalProperties(jsonSchema) {
	let newObj = {};
	let newValue;
	const entries = Object.entries(jsonSchema)
	log.debug(entries);
	for (const [key, value] of entries) {
 		log.debug(`Property: ${key} \nValue: ${value} Type ${typeof value}`)
 		if(key == "properties") {
 			jsonSchema.additionalProperties = false;
 			//entries.push(["additionalProperties",false]);
 		}
 		if(typeof value == "object") {
 			newValue = preventAdditionalProperties(value);
 		} else {
 			newValue = value;
 		}
 		jsonSchema[key]=newValue;		
	}
	newObj = jsonSchema;

	return newObj;

}
/*
 let   json = {
  "checked": false,
  "dimensions": {
    "width": 5,
    "height": 10
  },
  "id": 1,
  "name": "A green door",
  "price": 12.5,
  "tags": [
    "home",
    "green"
  ]
},
json2 = {
    "foo": "bar",
    "weight": 55,
    "name" : {
        "first": "joe",
        "last": "smith"
    },
    "age" : 33
},
    schemaObj;
 
schemaObj = jsonSchemaGenerator(json2);
console.log(JSON.stringify(schemaObj,undefined,4));*/