/*!
 * @overview  Coalesce-Ember
 * @copyright Copyright 2014 Gordon L. Hempton and contributors
 * @license   Licensed under MIT license
 *            See https://raw.github.com/coalescejs/coalesce-ember/master/LICENSE
 * @version   0.4.0+dev.5b16715b
 */
define("coalesce-ember-test/_setup", [], function() {
  "use strict";
  var __moduleName = "coalesce-ember-test/_setup";
  document.write('<div id="ember-testing-container"><div id="ember-testing"></div></div>');
  Ember.LOG_STACKTRACE_ON_DEPRECATION = false;
  var syncForTest = function(fn) {
    var callSuper;
    if (typeof fn !== "function") {
      callSuper = true;
    }
    return function() {
      var override = false,
          ret;
      if (Ember.run && !Ember.run.currentRunLoop) {
        Ember.run.begin();
        override = true;
      }
      try {
        if (callSuper) {
          ret = this._super.apply(this, arguments);
        } else {
          ret = fn.apply(this, arguments);
        }
      } finally {
        if (override) {
          Ember.run.end();
        }
      }
      return ret;
    };
  };
  Ember.config.overrideAccessors = function() {
    Ember.set = syncForTest(Ember.set);
    Ember.get = syncForTest(Ember.get);
  };
  Ember.config.overrideClassMixin = function(ClassMixin) {
    ClassMixin.reopen({create: syncForTest()});
  };
  Ember.config.overridePrototypeMixin = function(PrototypeMixin) {
    PrototypeMixin.reopen({destroy: syncForTest()});
  };
  Ember.RSVP.Promise.prototype.then = syncForTest(Ember.RSVP.Promise.prototype.then);
  return {};
});

define("coalesce-ember-test/debug", [], function() {
  "use strict";
  var __moduleName = "coalesce-ember-test/debug";
  var set$ = Ember.set;
  var get$ = Ember.get;
  describe.skip('Debug', function() {
    var App,
        session;
    App = null;
    session = null;
    beforeEach(function() {
      var adapter;
      App = Ember.Namespace.create();
      set$(this, 'container', new Ember.Container);
      Coalesce.setupContainer(get$(this, 'container'));
      set$(App, 'User', get$(Coalesce, 'Model').extend({name: Coalesce.attr('string')}));
      set$(App, 'Post', get$(Coalesce, 'Model').extend({
        title: Coalesce.attr('string'),
        body: Coalesce.attr('string'),
        user: Coalesce.belongsTo(get$(App, 'User'))
      }));
      set$(App, 'Comment', get$(Coalesce, 'Model').extend({
        body: Coalesce.attr('string'),
        post: Coalesce.belongsTo(get$(App, 'Post'))
      }));
      get$(App, 'Post').reopen({comments: Coalesce.hasMany(get$(App, 'Comment'))});
      get$(App, 'User').reopen({posts: Coalesce.hasMany(get$(App, 'Post'))});
      get$(this, 'container').register('model:user', get$(App, 'User'));
      get$(this, 'container').register('model:post', get$(App, 'Post'));
      get$(this, 'container').register('model:comment', get$(App, 'Comment'));
      adapter = get$(this, 'container').lookup('adapter:main');
      return session = adapter.newSession();
    });
    it('flags relationship CPs as expensive', function() {
      var post,
          propertyInfo;
      post = session.create('post');
      propertyInfo = get$(post._debugInfo(), 'propertyInfo');
      return get$(get$(expect(get$(propertyInfo, 'expensiveProperties')), 'to'), 'have').members(['user', 'comments']);
    });
    return it('groups attributes and relationships correctly', function() {
      var groups,
          post;
      post = session.create('post');
      groups = get$(get$(post._debugInfo(), 'propertyInfo'), 'groups');
      get$(expect(get$(groups, 'length')), 'to').eq(4);
      get$(get$(expect(get$(groups[0], 'properties')), 'to'), 'have').members(['id', 'title', 'body']);
      get$(get$(expect(get$(groups[1], 'properties')), 'to'), 'deep').eq(['user']);
      return get$(get$(expect(get$(groups[2], 'properties')), 'to'), 'deep').eq(['comments']);
    });
  });
  return {};
});

define("coalesce-ember-test/initializers", ['./support/app'], function($__0) {
  "use strict";
  var __moduleName = "coalesce-ember-test/initializers";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  var set$ = Ember.set;
  var get$ = Ember.get;
  var $__1 = $__0,
      setupApp = $__1.setupApp,
      teardownApp = $__1.teardownApp;
  describe('initializers', function() {
    beforeEach(function() {
      return setupApp.apply(this);
    });
    afterEach(function() {
      return teardownApp.apply(this);
    });
    it('should setup container', function() {
      return get$(get$(get$(get$(expect(get$(this, 'container').lookup('session:main')), 'to'), 'not'), 'be'), 'null');
    });
    return it('should perform type injections', function() {
      visit('/');
      return get$(get$(get$(get$(expect(get$(get$(this, 'container').lookup('controller:application'), 'session')), 'to'), 'not'), 'be'), 'null');
    });
  });
  return {};
});

define("coalesce-ember-test/model", ['./support/app', 'coalesce-ember/model/model', 'coalesce-ember/model/model', 'coalesce/model/attribute', 'coalesce/model/belongs_to', 'coalesce/model/has_many'], function($__0,$__2,$__4,$__6,$__8,$__10) {
  "use strict";
  var __moduleName = "coalesce-ember-test/model";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  if (!$__6 || !$__6.__esModule)
    $__6 = {default: $__6};
  if (!$__8 || !$__8.__esModule)
    $__8 = {default: $__8};
  if (!$__10 || !$__10.__esModule)
    $__10 = {default: $__10};
  var set$ = Ember.set;
  var get$ = Ember.get;
  var $__1 = $__0,
      setupApp = $__1.setupApp,
      teardownApp = $__1.teardownApp;
  var Model = $__2.default;
  var $__5 = $__4,
      attr = $__5.attr,
      hasMany = $__5.hasMany,
      belongsTo = $__5.belongsTo;
  var Attribute = $__6.default;
  var BelongsTo = $__8.default;
  var HasMany = $__10.default;
  describe('ember/model', function() {
    var App,
        session;
    session = null;
    App = null;
    beforeEach(function() {
      setupApp.apply(this);
      App = get$(this, 'App');
      return true;
    });
    afterEach(function() {
      return teardownApp.apply(this);
    });
    describe('class definition', function() {
      beforeEach(function() {
        set$(this, 'Post', Model.extend({
          title: attr('string'),
          titleDisplay: Ember.computed(function() {
            return get$(this, 'title') && get$(this, 'title').toUpperCase();
          }).property('title'),
          comments: hasMany('comment')
        }));
        set$(this, 'Comment', Model.extend({post: belongsTo('post')}));
        get$(this, 'container').register('model:post', get$(this, 'Post'));
        return get$(this, 'container').register('model:comment', get$(this, 'Comment'));
      });
      it('supports computed properties', function() {
        var post;
        post = get$(this, 'Post').create({title: 'moby dick'});
        get$(expect(get$(post, 'title')), 'to').eq('moby dick');
        return get$(expect(get$(post, 'titleDisplay')), 'to').eq('MOBY DICK');
      });
      it('supports new()', function() {
        var post;
        post = new (get$(this, 'Post'));
        set$(post, 'title', 'new?');
        return get$(expect(get$(post, 'title')), 'to').eq('new?');
      });
      it('supports mixins', function() {
        var HasName,
            User,
            user;
        HasName = Ember.Mixin.create({nameDisplay: Ember.computed(function() {
            return get$(this, 'name').toUpperCase();
          }).property('name')});
        User = Model.extend(HasName, {name: attr('string')});
        user = User.create({name: 'test'});
        return get$(expect(get$(user, 'nameDisplay')), 'to').eq('TEST');
      });
      return describe('schema macros', function() {
        describe('attr', function() {
          it('defines an attribute', function() {
            return get$(get$(get$(expect(get$(get$(this, 'Post'), 'fields').get('title')), 'to'), 'be'), 'an').instanceOf(Attribute);
          });
          it('is observable', function() {
            var observerHit,
                post;
            post = get$(this, 'Post').create({title: 'one'});
            get$(expect(get$(post, 'title')), 'to').eq('one');
            observerHit = false;
            Ember.addObserver(post, 'title', function() {
              return observerHit = true;
            });
            set$(post, 'title', 'two');
            get$(expect(get$(post, 'title')), 'to').eq('two');
            return get$(get$(get$(expect(observerHit), 'to'), 'be'), 'true');
          });
          return it('notifies dependencies', function() {
            var observerHit,
                post;
            post = get$(this, 'Post').create({title: 'one'});
            get$(expect(get$(post, 'titleDisplay')), 'to').eq('ONE');
            observerHit = false;
            Ember.addObserver(post, 'titleDisplay', function() {
              return observerHit = true;
            });
            set$(post, 'title', 'two');
            get$(expect(get$(post, 'titleDisplay')), 'to').eq('TWO');
            return get$(get$(get$(expect(observerHit), 'to'), 'be'), 'true');
          });
        });
        describe('belongsTo', function() {
          it('defines a belongsTo relationships', function() {
            return get$(get$(get$(expect(get$(get$(this, 'Comment'), 'fields').get('post')), 'to'), 'be'), 'an').instanceOf(BelongsTo);
          });
          return it('is observable', function() {
            var comment,
                observerHit,
                post;
            post = get$(this, 'Post').create({comments: []});
            comment = get$(this, 'Comment').create({post: post});
            get$(expect(get$(comment, 'post')), 'to').eq(post);
            observerHit = false;
            Ember.addObserver(comment, 'post', function() {
              return observerHit = true;
            });
            set$(comment, 'post', null);
            return get$(get$(get$(expect(observerHit), 'to'), 'be'), 'true');
          });
        });
        return describe('hasMany', function() {
          return it('defines a hasMany relationship', function() {
            return get$(get$(get$(expect(get$(get$(this, 'Post'), 'fields').get('comments')), 'to'), 'be'), 'an').instanceOf(HasMany);
          });
        });
      });
    });
    describe('subclassing', function() {
      beforeEach(function() {
        set$(this, 'User', Model.extend({name: attr('string')}));
        return set$(this, 'Admin', get$(this, 'User').extend({role: attr('string')}));
      });
      it('can add fields', function() {
        return get$(get$(expect(get$(get$(this, 'Admin'), 'fields').get('role')), 'to'), 'exist');
      });
      it('inherits fields from parent', function() {
        return get$(get$(expect(get$(get$(this, 'Admin'), 'fields').get('name')), 'to'), 'exist');
      });
      return it('does not modify the parent fields', function() {
        return get$(get$(get$(expect(get$(get$(this, 'User'), 'fields').get('role')), 'to'), 'not'), 'exist');
      });
    });
    return describe('.isDirty', function() {
      return xit('is observable', function() {
        var observerHit,
            user;
        user = session.merge(new (get$(this, 'User'))({
          id: '1',
          name: 'Wes'
        }));
        get$(get$(get$(expect(get$(user, 'isDirty')), 'to'), 'be'), 'false');
        observerHit = false;
        Ember.addObserver(user, 'isDirty', function() {
          get$(get$(get$(expect(get$(user, 'isDirty')), 'to'), 'be'), 'true');
          return observerHit = true;
        });
        set$(user, 'name', 'Brogrammer');
        get$(get$(get$(expect(get$(user, 'isDirty')), 'to'), 'be'), 'true');
        return get$(get$(get$(expect(observerHit), 'to'), 'be'), 'true');
      });
    });
  });
  return {};
});

define("coalesce-ember-test/relationships", ['./support/app', 'coalesce-ember/model/model', 'coalesce-ember/model/model'], function($__0,$__2,$__4) {
  "use strict";
  var __moduleName = "coalesce-ember-test/relationships";
  if (!$__0 || !$__0.__esModule)
    $__0 = {default: $__0};
  if (!$__2 || !$__2.__esModule)
    $__2 = {default: $__2};
  if (!$__4 || !$__4.__esModule)
    $__4 = {default: $__4};
  var set$ = Ember.set;
  var get$ = Ember.get;
  var $__1 = $__0,
      setupApp = $__1.setupApp,
      teardownApp = $__1.teardownApp;
  var Model = $__2.default;
  var $__5 = $__4,
      attr = $__5.attr,
      belongsTo = $__5.belongsTo,
      hasMany = $__5.hasMany;
  describe('relationships', function() {
    beforeEach(function() {
      return setupApp.apply(this);
    });
    afterEach(function() {
      return teardownApp.apply(this);
    });
    return context('one->many', function() {
      beforeEach(function() {
        set$(this, 'User', Model.extend({name: attr('string')}));
        set$(get$(this, 'User'), 'typeKey', 'user');
        set$(this, 'Post', Model.extend({
          title: attr('string'),
          user: belongsTo('user'),
          comments: hasMany('comment')
        }));
        set$(get$(this, 'Post'), 'typeKey', 'post');
        set$(this, 'Comment', Model.extend({
          text: attr('string'),
          post: belongsTo('post')
        }));
        set$(get$(this, 'Comment'), 'typeKey', 'comment');
        get$(this, 'container').register('model:post', get$(this, 'Post'));
        get$(this, 'container').register('model:comment', get$(this, 'Comment'));
        return get$(this, 'container').register('model:user', get$(this, 'User'));
      });
      it('should use Ember.ArrayProxy for hasMany', function() {
        return get$(get$(get$(expect(get$(get$(this, 'Post').create(), 'comments')), 'to'), 'be'), 'an').instanceOf(Ember.ArrayProxy);
      });
      it('supports watching belongsTo properties that have a detached cached value', function() {
        var comment,
            deferred;
        deferred = Ember.RSVP.defer();
        set$(get$(this, 'session'), 'loadModel', function(model) {
          Ember.unwatchPath(comment, 'post.title');
          return deferred.resolve();
        });
        comment = get$(this, 'session').adopt(get$(this, 'session').build('comment', {
          id: 2,
          post: get$(this, 'Post').create({id: 1})
        }));
        Ember.run(function() {
          return Ember.watchPath(comment, 'post.title');
        });
        return get$(deferred, 'promise');
      });
      return it('supports watching multiple levels of unloaded belongsTo', function() {
        var comment,
            deferred,
            Post,
            User;
        deferred = Ember.RSVP.defer();
        Post = get$(this, 'Post');
        User = get$(this, 'User');
        set$(get$(this, 'session'), 'loadModel', function(model) {
          if (model instanceof Post) {
            model = model.copy();
            set$(model, 'title', 'post');
            set$(model, 'user', User.create({id: '2'}));
            this.merge(model);
            return Ember.RSVP.resolve(model);
          } else {
            return deferred.resolve();
          }
        });
        comment = get$(this, 'session').adopt(get$(this, 'session').build('comment', {
          id: 2,
          post: get$(this, 'Post').create({id: 1})
        }));
        Ember.run(function() {
          return Ember.watchPath(comment, 'post.user.name');
        });
        return get$(deferred, 'promise').then(function() {
          return Ember.unwatchPath(comment, 'post.user.name');
        });
      });
    });
  });
  return {};
});

define("coalesce-ember-test/support/app", [], function() {
  "use strict";
  var __moduleName = "coalesce-ember-test/support/app";
  function setupApp() {
    var self = this;
    Ember.run(function() {
      self.App = Ember.Application.create({rootElement: '#ember-testing'});
      self.App.setupForTesting();
      self.App.injectTestHelpers();
    });
    this.container = this.App.__container__;
    this.session = this.container.lookup('session:main');
  }
  function teardownApp() {
    var self = this;
    Ember.run(function() {
      self.App.destroy();
    });
  }
  ;
  return {
    get setupApp() {
      return setupApp;
    },
    get teardownApp() {
      return teardownApp;
    },
    __esModule: true
  };
});
