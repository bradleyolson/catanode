var util = require('util');

require('./lib/utility');

module.exports = function(app, io, gameserver, passport, db) {
  app.get('/', function(req, res) {
    return res.render('index', {
      user: req.user || null, 
      gameserver: gameserver
    });
  });

  app.get('/create', 
    ensureAuthenticated,
    function(req, res) {
      var game = gameserver.create();

      if( typeof game.id === "number" ) {
        return res.redirect( '/connect/' + game.id );
      } else {
        return res.render('error', {
          reason: "Too many games are going on."
        });
      }
  });

  app.get('/connect', function(req, res) {
      return res.redirect( '/create' );
  });

  app.get('/connect/:game_id', function(req, res) {
    if( !gameserver.games[req.params.game_id] ) {
      var game = gameserver.games[ req.params.game_id ] || gameserver.create( req.params.game_id );

      if (game.id !== req.params.game_id) {
        return res.redirect('/connect/' + game.id);
      }
    }

    if( req.user && io.client ) {
      io.client.join( req.params.game_id );

      // emit a user has joined 'game_view'
      io.client.emissions.message({
        game: req.params.game_id,
        message: "\"" + req.user.username + "\" has joined the server"
      });
    }

    return res.render('setup', {
      user: req.user || false,
      game_id: req.params.game_id,
      players: gameserver.games[req.params.game_id].players,
      url: req.headers.host + req.url
    });
  });

  app.get('/signup', function(req, res) {
    res.render('signup', { 
      user: req.user || false,
      message: false 
    });
  });

  app.post('/signup', function(req, res, next) {
    db.saveUser(req.body.user, function(err, user) {
      if( err ) {
        return res.render('signup', { 
          user: req.user || false,
          message: err 
        });
      } else {
        passport.authenticate('local', function(err, user, info) {
          if (err) { return next(err); }
          if (!user) { return res.redirect('/login'); }

          req.logIn(user, function(err) {
            if (err) { return next(err); }

            return res.redirect('/');
          });
        })(req, res, next);
      }
    });
  });

  app.get('/login', function(req, res){
    var login_err = req.flash('error').length > 0 ? req.flash('error') : false;

    req.session.referrerURL = req.headers.referer || "/";

    return res.render('login', { 
      user: req.user, 
      message: login_err
    });
  });

  app.post('/login',
    passport.authenticate('local', 
      { failureRedirect: '/login', 
        failureFlash: "Invalid login credentials" }),
    function(req, res) {
      var redirectTo = "/";
      if( req.session && req.session.referrerURL && !req.session.referrerURL.includes('logout') ) {
        redirectTo = req.session.referrerURL;
      }

      res.redirect( redirectTo );
    });

  app.get('/settings/:user', function(req, res) {
    if( req.user && req.user.username === req.params.user ) {
      return res.render('user/settings', { user: req.user });
    } else {
      db.userByUsername(req.params.user, function(err, user) {
        if( user ) {
          return res.render('user/view', { 
            user: false,
            searched: user
          });
        }

        return res.render('user/error', { 
          user: false, 
          error: "The user \"" + req.params.user + "\" doesn't exist."
        });
      });
    }
  });

  app.get('/logout', function(req, res) {
    req.logout();
    res.redirect( req.headers.referer || '/' );
  });

  app.get('*', function(req, res) {
    res.status(404);

    // user or false
    return res.render('error', {
      user: false,
      status: res.statusCode,
      reason: "The page you requested was not found.",
      page: req.headers.host + req.url
    });
  });

  function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { 
      return next(); 
    }
    res.redirect('/login');
  }
}
