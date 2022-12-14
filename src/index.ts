
import http from 'http';
import dotenv from 'dotenv';
import WebSocket, {WebSocketServer} from 'ws';
import {ChatGPTAPI, ChatGPTConversation} from 'chatgpt';

/**
 * 加载本地配置
 */
dotenv.config();


/**
 * 创建chatAPI
 * 如果错误了返回错误信息，没有错误则发货undefined
 */
let chatGPTAPI: ChatGPTAPI;
async function createChatGPTAPI(): Promise<Error | undefined> {
    try {
        const api = new ChatGPTAPI({
            clearanceToken: <string>process.env.OPENAI_CLEARANCE_TOKEN,
            sessionToken: <string>process.env.OPENAI_SESSION_TOKEN,
        });
        await api.ensureAuth();
        chatGPTAPI = api;
    }
    catch (err) {
        return err as Error;
    }
}

async function createConversation(): Promise<ChatGPTConversation> {
    return chatGPTAPI.getConversation();
}

async function responseMessage(conversation: ChatGPTConversation, message: string) {
    return conversation.sendMessage(message);
}

function responseData(client: WebSocket, action: string, data: {[p: string]: string} = {}) {
    return client.send(JSON.stringify({action, ...data}));
}

async function main() {
    /**
     * chatGPT验证
     */
    const createError = await createChatGPTAPI();
    if (createError) {
        throw createError;
    }

    /**
     * 创建Server
     */
    const server = http.createServer();
    const wss = new WebSocketServer({server});
    server.listen(process.env.SERVER_PORT, () => {
        console.log('server已经启动', `http://127.0.0.1:${process.env.SERVER_PORT}`);
    });

    wss.on('connection', client => {
        let conversation: ChatGPTConversation;
    
        client.on('message', async (msg: string) => {
            const {action, message} = JSON.parse(msg.toString());
            switch (action) {
                case 'init conversation':
                    conversation = await createConversation();
                    responseData(client, 'init conversation');
                    break;
                case 'new message':
                    const response = await responseMessage(conversation, message);
                    responseData(client, 'new message', {message: response});
                    break;
                default:
                    responseData(client, 'new message', {message: `action未定义: ${action}`});
                    break;
            }
        });
    });
}

main();
