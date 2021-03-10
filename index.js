// Imports
const express = require("express");
const admin = require("firebase-admin");

// Port number that app is running on
const port = 3000;

// Initializing Firebase Admin
admin.initializeApp( {
    credential: admin.credential.cert({
        "type": process.env["PWASBU_USER_DELETION_TYPE"],
        "project_id": process.env["PWASBU_USER_DELETION_PROJECT_ID"],
        "private_key_id": process.env["PWASBU_USER_DELETION_PRIVATE_KEY_ID"],
        "private_key": process.env["PWASBU_USER_DELETION_PRIVATE_KEY"].replace(/\\n/g, '\n'),
        "client_email": process.env["PWASBU_USER_DELETION_CLIENT_EMAIL"],
        "client_id": process.env["PWASBU_USER_DELETION_CLIENT_ID"],
        "auth_uri": process.env["PWASBU_USER_DELETION_AUTH_URI"],
        "token_uri": process.env["PWASBU_USER_DELETION_TOKEN_URI"],
        "auth_provider_x509_cert_url": process.env["PWASBU_USER_DELETION_AUTH_PROVIDER_X509_CERT_URL"],
        "client_x509_cert_url": process.env["PWASBU_USER_DELETION_CLIENT_X509_CERT_URL"]
    }),
    storageBucket: "pwasbu.appspot.com"
});

// Accessing Firebase services
const auth = admin.auth();
const db = admin.firestore();
const storage = admin.storage().bucket();

// Express object
const app = express();

// Default route
app.get('/', (request, response) => {
    response.send('Server running properly');
});

// Route for executing deletion
app.get('/delete', (request, response) => {
    let responseText = "";
    db.collection("UsersToDelete").doc('users').get().then( (doc) => {
        if(doc.exists) {
            let users = doc.data()["users"];
            let uids = Object.keys(users);
            // Deleting users using their uid's
            auth.deleteUsers(uids).then( (deleteUsersResult) => {
                for (let uid in users) {
                    data = users[uid];
                    // Clearing profile picture of deleted user
                    storage.getFiles({ prefix: `users/${data.email}/profile-picture/` }).then( (files) => {
                        files[0].forEach( (file) => {
                            file.delete().then( () => {
                                console.log(`Deleted profile pic of user ${uid}`);
                            }).catch( (err) => {
                                console.log(err);
                            });
                        });
                        // Removing groups associated with this account
                        db.collection("Groups").where("coach", "==", uid).get().then( (querySnapshot) => {
                            querySnapshot.forEach( (doc) => {
                                doc.ref.delete();
                            });
                            // Removing evaluations associated with this account
                            db.collection("Evaluations").where("instructor", "==", uid).get().then( (querySnapshot) => {
                                querySnapshot.forEach(function(doc) {
                                    doc.ref.delete();
                                });
                            });
                        });
                    });
                }
                // Clearing list of disabled user accounts since they have now been deleted
                db.doc("UsersToDelete/users").set({
                    users: {}
                });
                // Sending back response
                responseText += `<h2>Successfully deleted ${deleteUsersResult.successCount} users</h2>`;
                responseText += `<h2>Failed to delete ${deleteUsersResult.failureCount} users</h2>`;
                responseText += `<h2>Errors:<h2><ul>`;
                deleteUsersResult.errors.forEach((err) => {
                    responseText += `<li>${JSON.stringify(err.error.toJSON())}</li>`;
                });
                responseText += `</ul>`;
                response.send(responseText);
            }).catch((error) => {
                response.send('Error deleting users: ' + error);
            });
        } else {
            // Creating document if it doesn't already exist
            db.doc("UsersToDelete/users").set({
                users: {}
            });
        }
    }).catch( (error) => {
        response.send('Error deleting users: ' + error);
    });
});

// Prompts app to listen on port number defined earlier
app.listen(process.envPORT || port, () => {
    console.log(`Listening on ${port}`);
});
