const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length; // Get the number of CPU cores
const app = require('./app');

const port = process.env.PORT || 8083;

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    // Fork workers for each CPU
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        console.log('Forking a new worker');
        cluster.fork(); // Restarting the worker
    });
} else {
    // Each worker creates an HTTP server
    const server = http.createServer(app);

    server.listen(port, () => {
        console.log(`Worker ${process.pid} started, listening on ${port}`);
    });
}
