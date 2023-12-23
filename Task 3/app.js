const express = require("express");
const cors = require('cors');
const app = express();
const http = require('http');
const path = require('path');
const httpServer = http.Server(app);
const {Server} = require("socket.io");
const {query} = require("express");
const io = new Server(httpServer);

const QueryEngine = require('@comunica/query-sparql').QueryEngine;

const engine = new QueryEngine();

const port = 5000;

app.use(cors())

app.use(express.json())

app.use(express.static('public'))


app.get('/', (req, res) => {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html");
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/movies', async (req, res) => {
    let input_url = req.query.url
    res.statusCode = 200
    res.setHeader("Content-Type", "text/html");
    res.sendFile(path.join(__dirname, 'index.html'));
    await handle_query(input_url)
});

app.get('/search', async (req, res) => {
    let url_keyword = req.query.keyword_url
    let keyword = req.query.keyword
    res.statusCode = 200
    res.setHeader("Content-Type", "text/html");
    res.sendFile(path.join(__dirname, 'index.html'));
    await handle_query_by_movie_name(url_keyword, keyword)
});


async function handle_query(input_url) {
    let movie_urls = [] //List of movies in the pod
    await engine.queryBindings(`SELECT ?v WHERE { ?container <http://www.w3.org/ns/ldp#contains> ?v . }`, {
        sources: [input_url],
    }).then(function (bindingsStream) {
        bindingsStream.on('data', function (data) {
            movie_urls.push(data.get('v').value) //Variable ?v in the SPARQL query.
        });
        bindingsStream.on('end', function () {
            engine.queryBindings(`SELECT ?name ?image WHERE {?movie <https://schema.org/name> ?name. ?movie <https://schema.org/image> ?image.}`, {
                sources: movie_urls,
            }).then(function (bindingsStream) {
                bindingsStream.on('data', function (data) {
                    let obj = {
                        "name": data.get('name').value, //Variable ?name in the SPARQL query.
                        "image": data.get('image').value //Variable ?image in the SPARQL query.
                    };
                    io.emit('update', {'message': obj}) //Send information to the browser.
                });
            });
        })
    });
}

async function handle_query_by_movie_name(keyword_url, keyword) {
    let movie_urls = []; // List of movies in the pod

    // Query to get all movie URLs
    await engine.queryBindings('SELECT ?v WHERE { ?container <http://www.w3.org/ns/ldp#contains> ?v . }', {
        sources: [keyword_url],
    }).then(function (bindingsStream) {
        bindingsStream.on('data', function (data) {
            movie_urls.push(data.get('v').value);
        });
    });
    await engine.queryBindings(`SELECT ?name ?image WHERE { 
                ?movie <https://schema.org/name> ?name .
                ?movie <https://schema.org/image> ?image .
                FILTER CONTAINS(LCASE(STR(?name)), LCASE(STR("${keyword}")))
            }`, {
        sources: movie_urls,
    }).then(function (bindingsStream) {
        bindingsStream.on('data', function (data) {
            console.log('Element is: ', data.get('name').value)
            let obj = {
                "name": data.get('name').value,
                "image": data.get('image').value
            };
            io.emit('update', {'message': obj});
        });
    });
}
  
  httpServer.listen(port), 
      () => console.log("Server is running... on "+port);