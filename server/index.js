var path = require('path'),
    fs = require('fs'),
    express = require('express'),
    app = express(),
    compression = require('compression'),
    exphbs = require('express-handlebars'),
    Promise = require('promise'),
    find = require('lodash.find'),
    assign = require('lodash.assign'),
    util = require('./util');

var rootDir = path.resolve(__dirname, '..'),
    clientDir = path.resolve(rootDir, 'client');

var defaults = {
    components: path.resolve(process.cwd(), 'components'),
    rootName: 'root',
    data: path.resolve(process.cwd(), 'data'),
    staticLocalDir: path.resolve(process.cwd(), 'compiled'),
    staticPath: '/compiled',
    stylesheets: ['stylesheet.css'],
    scripts: ['bundle.js'],
    ext: 'html',
    middlewares: []
};

module.exports = function start(options) {

    options = options || {};

    var ext = options.ext || defaults.ext,
        componentDir = options.components || defaults.components,
        rootName = options.rootName || defaults.rootName,
        dataDir = options.data || defaults.data,
        staticLocalDir = options.staticLocalDir || options.static || defaults.staticLocalDir,
        staticPath = options.staticPath || defaults.staticPath,
        stylesheets = options.stylesheets || defaults.stylesheets,
        scripts = options.scripts || defaults.scripts,
        middlewares = options.middlewares || defaults.middlewares;

    var ehbs = exphbs.create({
        defaultLayout: 'component',
        layoutsDir: clientDir,
        extname: '.html',
        partialsDir: componentDir
    });

    var staticConfig = {
        staticPath: staticPath,
        stylesheets: stylesheets,
        scripts: scripts
    };

    middlewares.forEach(function(middleware) {
        app.use(middleware);
    });

    app.engine(ext, ehbs.engine);
    app.set('views', [clientDir, componentDir]);
    app.set('view engine', ext);
    app.use(compression());
    app.use('/client', express.static(clientDir));
    app.use(staticPath, express.static(staticLocalDir));

    return new Promise(function(resolve, reject) {

        return ehbs.getPartials().then(function(partials) {

            return ehbs.getTemplates(componentDir).then(function(templates) {

                var data = util.getTemplateData(dataDir + '/**/*.json'),
                    components = util.getComponentsInfo({
                        componentDir: componentDir,
                        rootName: rootName,
                        templates: templates,
                        partials: partials,
                        data: data
                    });

                app.get('/', function(req, res) {
                    res.render('styleguide', {
                        layout: false,
                        pages: components.menu
                    });
                });

                app.get('/all', function(req, res) {
                    res.render('all', assign({}, staticConfig, {
                        layout: false,
                        components: components.overview
                    }));
                });

                app.get('/:type/:id?', function(req, res) {
                    var componentType = req.params.id ? req.params.type : rootName,
                        componentName = (req.params.id ? req.params.id : req.params.type).replace('.' + ext, ''),
                        component = find(components.all, {type: componentType, name: componentName});
                    if(component) {
                        res.render(component.path, assign({}, staticConfig, data, component));
                    } else {
                        res.sendStatus(404);
                    }
                });

                app.set('port', (process.env.PORT || 3000));

                var server = app.listen(app.get('port'), function() {
                    var host = server.address().address,
                        port = server.address().port;
                    console.log('Styleguide server started at http://%s:%s', host, port)
                });

                resolve({
                    app: app,
                    server: server,
                    ehbs: ehbs
                })

            }).catch(reject);

        }).catch(reject);

    }).catch(function(err){
        console.error(err.stack);
    });

};
