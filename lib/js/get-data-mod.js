//adapted from the cerner smart on fhir guide. updated to utalize client.js v2 library and FHIR R4

// helper function to process fhir resource to get the patient name.
function getPatientName(pt) {
    if (pt.name) {
        var names = pt.name.map(function(name) {
            return name.given.join(" ") + " " + name.family;
        });
        return names.join(" / ")
    } else {
        return "anonymous";
    }
}

// display the patient name gender and dob in the index page
function displayPatient(pt) {
    document.getElementById('patient_name').innerHTML = getPatientName(pt);
    document.getElementById('gender').innerHTML = pt.gender;
    document.getElementById('dob').innerHTML = pt.birthDate;
}

//function to display list of medications
function displayMedication(meds) {
    med_list.innerHTML += "<li> " + meds + "</li>";
}

//helper function to get quanity and unit from an observation resoruce.
function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
        return Number(parseFloat((ob.valueQuantity.value)).toFixed(2)) + ' ' + ob.valueQuantity.unit;
    } else {
        return undefined;
    }
}

// helper function to get both systolic and diastolic bp
function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation) {
        var BP = observation.component.find(function(component) {
            return component.code.coding.find(function(coding) {
                return coding.code == typeOfPressure;
            });
        });
        if (BP) {
            observation.valueQuantity = BP.valueQuantity;
            formattedBPObservations.push(observation);
        }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
}

// create a patient object to initalize the patient
function defaultPatient() {
    return {

        OpR: {
            value: ''
        },
        DAST: {
            value: ''
        },
        height: {
            value: ''
        },
        weight: {
            value: ''
        },
        sys: {
            value: ''
        },
        dia: {
            value: ''
        },
        ldl: {
            value: ''
        },
        hdl: {
            value: ''
        },
        note: 'No Annotation',
    }
        ;
}

//helper function to display the annotation on the index page
function displayAnnotation(annotation) {
    note.innerHTML = annotation;
}
function displaysuggested_screenings(screenings) {
    SScreening.innerHTML = screenings;
}
//function to display the observation values you will need to update this
function displayObservation(obs) {
    height.innerHTML =obs.height;
    weight.innerHTML = obs.weight;
    hdl.innerHTML = obs.hdl;
    ldl.innerHTML = obs.ldl;
    sys.innerHTML = obs.sys;
    dia.innerHTML = obs.dia;
    OpR.innerHTML = obs.OpR;
    DAST.innerHTML =obs.DAST;

}


//once fhir client is authorized then the following functions can be executed
FHIR.oauth2.ready().then(function(client) {

    // get patient object and then display its demographics info in the banner
    client.request(`Patient/${client.patient.id}`).then(
        function(patient) {
            displayPatient(patient);
            console.log(patient);
        }
    );

    // get observation resoruce values
    // you will need to update the below to retrive the weight and height values
    var query = new URLSearchParams();

    query.set("patient", client.patient.id);
    query.set("_count", 100);
    query.set("_sort", "-date");
    query.set("code", [
        'http://loinc.org|29463-7', // weight
        'http://loinc.org|8302-2' , // Body height
        'http://loinc.org|8462-4',
        'http://loinc.org|8480-6',
        'http://loinc.org|2085-9',
        'http://loinc.org|2089-1',
        'http://loinc.org|55284-4',
        'http://loinc.org|3141-9',
        'http://loinc.org|82667-7',
        'http://loinc.org| 91392-1' // total score
    ].join(","));

    client.request("Observation?" + query, {
        pageLimit: 0,
        flat: true
    }).then(
        function(ob) {

            // group all of the observation resoruces by type into their own
            var byCodes = client.byCodes(ob, 'code');
            var systolicbp = getBloodPressureValue(byCodes('55284-4'), '8480-6');
            var diastolicbp = getBloodPressureValue(byCodes('55284-4'), '8462-4');
            var hdl = byCodes('2085-9');
            var ldl = byCodes('2089-1');
            var height = byCodes(  '8302-2');
            var weight = byCodes(      '3141-9');
            var OpR = byCodes('91392-1');   // total scor 0-3 good 3-7 slight risk -8 up higher risk
            var DAST = byCodes( '82667-7');
            // create patient object
            var p = defaultPatient();

            // set patient value parameters to the data pulled from the observation resoruce
            if (typeof systolicbp != 'undefined') {
                p.sys = systolicbp;
            } else {
                p.sys = 'undefined'
            }

            if (typeof diastolicbp != 'undefined') {
                p.dia = diastolicbp;
            } else {
                p.dia = 'undefined'
            }

            p.hdl = getQuantityValueAndUnit(hdl[0]);
            p.ldl = getQuantityValueAndUnit(ldl[0]);
            p.height = getQuantityValueAndUnit(height[0]);
            p.weight = getQuantityValueAndUnit(weight[0]);
            // check if first is undefined like above fixed weight obs
            if (p.weight = 'undefined') {
                weight = byCodes(      '29463-7');
                p.weight = getQuantityValueAndUnit(weight[0]);
            }
            if (typeof weight[0].note != 'undefined') {
                p.note = weight[0].note[0].text;
            }
            p.DAST = getQuantityValueAndUnit(DAST[0]);
            if(p.DAST ='undefined'){
                p.DAST = 10;
            }
            p.OpR =getQuantityValueAndUnit(OpR[0]);
            if(p.OpR ='undefined'){
                p.OpR= 10;
            }
            if (p.OpR>3){
                screenings = [ '82666-9 Loinc code dast 10 panel '];
                displaysuggested_screenings(screenings);
            }else{
                screenings = [ 'low risk urine test may be needed for assessment '];
                displaysuggested_screenings(screenings);
            }

            addictionChecker();
            displayObservation(p);
            displayAnnotation(p.note);





        });
//all below fount on smart fihr examples modified from that
// dummy data for medrequest
    function fetchmeds(client) {
        var query = new URLSearchParams();
        query.set("patient", client.patient.id);
        query.set("_count", 100); // Try this to fetch fewer pages
        return client.request(`MedicationRequest/${client.patient.id}`, {
            resolveReferences: "medicationReference"})
        // return client.request(`/MedicationRequest?Patient=smart-{client.patient.id}`, {
        //     resolveReferences: "medicationReference"
        // });
    }


    // Get MedicationRequests for the selected patient
// example from https://docs.smarthealthit.org/tutorials/javascript/  modified for our lab
    client.request("/MedicationRequest?patient=" + client.patient.id, {
        resolveReferences: "medicationReference"
    }).then(function(data) {
        if (!data.entry || !data.entry.length) {
            throw new Error("No medications found for the selected patient");
        }

        return data.entry;
    }).then(
        function(meds) {
            meds.forEach(function(med) {
                //display by the code  sub chapter of medications
                displayMedication(med.resource.medicationCodeableConcept.text);
            })
        },
        function(error) {
            console.log(error.stack)
            //document.getElementById("meds").innerText = error.stack;
        }
    );
// get medication request resources this will need to be updated
// document.getElementById('med_list');
// the goal is to pull all the medication requests and display it in the app. It can be both active and stopped medications
// if (medResults.length==0 ){
//     medResults =["No medication for Patient "]
// }else (
// medResults.forEach(function(med) {
//   displayMedication(med);
// })
//update function to take in text input from the app and add the note for the latest weight observation annotation
//you should include text and the author can be set to anything of your choice. keep in mind that this data will
// be posted to a public sandbox
// updated quarry to add in to weight got example from same website above modified for this l
//     function addWeightAnnotation() {
//         var annotation =document.getElementById(  'annotation').value ;
//
//
//         displayAnnotation(annotation);
//         var annotation = document.getElementById('annotation').value;
//         var curdate  = new Date();
//
//         var note = {authorString: 'DR strange ',
//             time:curdate.toISOString(),
//             text: annotation};
//
//         var query = new URLSearchParams();
//         query.set("patient", client.patient.id);
//         query.set("_count", 100);
//         query.set("_sort", "-date");
//         // query.set("code", 'http://loinc.org|29463-7');  // added weight to qurry
//         client.request("MedicationStatement?" + query, {
//             pageLimit: 0,
//             flat: true
//         }).then(
//             function(ob) {
//                 console.log(ob)
//                 ob.note = {
//                     'authorString': 'Dr strange',
//                     'text': annotation,
//                     'time': new Date.toISOString()
//                 };
//                 client.update(ob.note);
//             }
//         );
//
//         displayAnnotation(annotation);
//     }


    function addictionChecker(){

        document.getElementById('PatientRisk').innerHTML = "Moderate Risk Please use CDC guidlines for prescriptions and renewals" ;
        screenings = [ 'TRY ALT THERAPY *HIGH RISK* 82666-9 Loinc code dast 10 panel '];
        displaysuggested_screenings(screenings);






    }

//event listner when the add button is clicked to call the function that will add the note to the weight observatio
    document.getElementById('add').addEventListener('click', addWeightAnnotation);

    document.getElementById('submit').addEventListener('click', addictionChecker);


}).catch(console.error);
