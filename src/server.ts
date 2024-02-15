import http, { IncomingMessage } from "node:http";

export default class Server {



  constructor() {

  }

  getBody = async (request: IncomingMessage) => {
    return new Promise((resolve, reject) => {
      let body = '';
      request.on('data', chunk => {
        body+= chunk.toString();
      });
      request.on('end', () => {
        resolve(body);
      });
      request.on('error', error => {
        reject(error);
      })
    });
  }

  createServer = () => {
    const server = http.createServer(async (request, response) => {
      if (request.method === 'POST') {
        const body = await this.getBody(request);
        console.log(body);
      }
    })

    server[Symbol.asyncIterator] = function() {
        return {
            next() {
                return new Promise((resolve, reject) => {
                    const onRequest = (request, response) => {
                        resolve({
                            done: false,
                            value: { request, response }
                        })

                        server.off("request", onRequest)
                    }

                    server.on("request", onRequest)
                })
            }
        }
    }

    return server
}

  run() {
    http.createServer((req, res))
  }
}