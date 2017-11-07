const RtmClient = require("@slack/client").RtmClient;
const CLIENT_EVENTS = require("@slack/client").CLIENT_EVENTS;
const RTM_EVENTS = require("@slack/client").RTM_EVENTS;
const watson = require("watson-developer-cloud");

// Credentials
const config = {
    watson: {
        conversation: {
            username: "<service username>",
            password: "<service password>",
            workspaceId: "<workspace id>"
        }
    },
    slack: {
        apiToken: "<api token>"
    }
};

/**
 * Instantiate the Watson Conversation Service
 */
const conversation = new watson.ConversationV1({
  username: process.env.CONVERSATION_USERNAME || config.watson.conversation.username,
  password: process.env.CONVERSATION_PASSWORD || config.watson.conversation.password,
  version_date: watson.ConversationV1.VERSION_DATE_2017_05_26
});

/**
 * Calls the Watson Conversation message api.
 * @returns {Promise}
 */
const watsonMessage = (text, context) => {
    const payload = {
        workspace_id: process.env.WORKSPACE_ID || config.watson.conversation.workspaceId,
        input: {
            text
        },
        context
    };

    return new Promise((resolve, reject) =>
        conversation.message(payload, (error, data) => {
            if (error) {
                reject(error);
            } else {
                resolve(data);
            }
        })
    );
};

// Connect to slack
const rtm = new RtmClient(process.env.SLACK_API_TOKEN || config.slack.apiToken);
rtm.start();

rtm.on(CLIENT_EVENTS.RTM.AUTHENTICATED, (rtmStartData) => {
    console.log(`Logged in as ${rtmStartData.self.name} of team ${rtmStartData.team.name}`);
});

rtm.on(CLIENT_EVENTS.RTM.RTM_CONNECTION_OPENED, () => {
    console.log("Slack cnnection opened.");
});

// Store contect for each user, using the user ID as the key
const contexts = {};

// Handle Slack message, redirect to Watson
rtm.on(RTM_EVENTS.MESSAGE, message => {
    watsonMessage(message.text, contexts[message.user]).then(response => {
        // Save the context using the user ID
        contexts[message.user] = response.context;

        // Send Watson message to Slack
        rtm.sendMessage(response.output.text.join("\n"), message.channel);
    })
    .catch(error => {
        console.error(JSON.stringify(error, null, 2));
        rtm.sendMessage("Watson error.", message.channel);
    });
});
