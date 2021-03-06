/** User Schema for CrowdNotes **/

var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var passport = require('passport');
var bcrypt = require('bcrypt-nodejs');

// Define schema
var UserSchema = new Schema({
  name: {
    first: { type: String, required: true },
    last: { type: String, required: true }
  },
  email: { type: String, unique: true, required: true },
  username: { type: String, unique: true, required: true },

  salt: { type: String, required: true },
  hash: { type: String, required: true }
});

UserSchema.virtual('password').get(function() {
  return this._password;
}).set(function (password) {
  this._password = password;
  var salt = this.salt = bcrypt.genSaltSync(10);
  this.hash = bcrypt.hashSync(password, salt);
});

UserSchema.method('verifyPassword', function(password, callback) {
  bcrypt.compare(password, this.hash, callback);
});

UserSchema.static('authenticate', function(username, password, callback) {
  this.findOne({ username: username }, function(err, user) {
    if (err) { return callback(err); }
    if (!user) { return callback(null, false); }

    user.verifyPassword(password, function(err, passwordCorrect) {
      if (err) { return callback(err); }
      if (!passwordCorrect) { return callback(null, false); }
      return callback(null, user);
    });
  });
});

module.exports = mongoose.model('User', UserSchema);
