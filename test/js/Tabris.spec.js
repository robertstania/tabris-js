/**
 * Copyright (c) 2014 EclipseSource.
 * All rights reserved.
 */

describe("tabris", function() {

  var nativeBridge;
  var log;

  beforeEach(function() {
    nativeBridge = new NativeBridgeSpy();
    log = [];
    tabris._reset();
    tabris._start(nativeBridge);
    tabris.registerType("TestType", {});
  });

  afterEach(function() {
    delete tabris.TestType;
  });

  describe("when used as a function", function() {

    it("returns a proxy with the given string as id and type", function() {
      var result = tabris("TestType");

      expect(result).toEqual(jasmine.any(tabris.TestType));
      expect(result.id).toBe("TestType");
    });

    it("returns a proxy with translated id and type", function() {
      tabris.TestType._type = "CustomType";
      var result = tabris("TestType");

      expect(result).toEqual(jasmine.any(tabris.TestType));
      expect(result.id).toBe("CustomType");
    });

    it("returns same proxy instance for the same id", function() {
      tabris.TestType._type = "CustomType";
      var result1 = tabris("TestType");
      var result2 = tabris("TestType");

      expect(result1).toBe(result2);
    });

    it("returns same proxy instance for the same translated id", function() {
      var result1 = tabris("TestType");
      var result2 = tabris("TestType");

      expect(result1).toBe(result2);
    });

    it("does not call create on native bridge", function() {
      tabris("TestType");

      expect(nativeBridge.calls().length).toBe(0);
    });

    it("fails for unknown types", function() {
      expect(function() {
        tabris("foo");
      }).toThrow();
    });

  });

  describe("_start", function() {

    it("can be called without a context", function() {
      tabris._start.call(null, nativeBridge);
    });

    it("executes all load functions", function() {
      tabris.load(function() {
        log.push("foo");
      });
      tabris.load(function() {
        log.push("bar");
      });

      tabris._start.call(null);

      expect(log).toEqual(["foo", "bar"]);
    });

    it("load functions can access tabris functions", function() {
      tabris.load(function() {
        tabris.create("TestType");
      });

      tabris._start.call(null, nativeBridge);

      expect(nativeBridge.calls({op: "create", type: "TestType"}).length).toBe(1);
    });

  });

  describe("_notify", function() {

    var proxy;

    beforeEach(function() {
      tabris.TestType._trigger = {};
      proxy = tabris.create("TestType", {});
      spyOn(proxy, "trigger");
    });

    it("notifies widget proxy", function() {
      tabris._notify(proxy.id, "foo", {bar: 23});

      expect(proxy.trigger).toHaveBeenCalledWith("foo", {bar: 23});
    });

    it("notifies widget proxy with translated event name", function() {
      tabris.TestType._trigger.foo = "bar";
      tabris._notify.call(window, proxy.id, "foo", {});

      expect(proxy.trigger).toHaveBeenCalledWith("bar", {});
    });

    it("calls custom trigger", function() {
      tabris.TestType._trigger.foo = jasmine.createSpy();
      tabris._notify.call(window, proxy.id, "foo", {bar: 23});

      expect(tabris.TestType._trigger.foo).toHaveBeenCalledWith({bar: 23});
    });

    it("silently ignores events for non-existing ids (does not crash)", function() {
      tabris._notify("no-id", "foo", [23, 42]);
    });

    it("can be called without a context", function() {
      tabris._notify.call("no-id", "foo", [23, 42]);
    });

  });

  describe("load", function() {

    it("function is executed at start time", function() {
      var fn = jasmine.createSpy();

      tabris.load(fn);
      tabris._start(nativeBridge);

      expect(fn).toHaveBeenCalled();
    });

    it("nested load functions are executed at the end", function() {
      var log = [];

      tabris.load(function() {
        log.push("1");
        tabris.load(function() {
          log.push("1a");
        });
        tabris.load(function() {
          log.push("1b");
        });
      });
      tabris.load(function() {
        log.push("2");
      });
      tabris._start(nativeBridge);

      expect(log).toEqual(["1", "2", "1a", "1b"]);
    });

  });

  describe("create", function() {

    it("fails if tabris.js not yet started", function() {
      delete tabris._nativeBridge;

      expect(function() {
        tabris.create("TestType", {});
      }).toThrowError("tabris.js not started");
    });

    it("fails if type is unknown", function() {
      expect(function() {
        tabris.create("UnknownType", {});
      }).toThrowError("Unknown type UnknownType");
    });

    it("creates a non-empty widget id", function() {
      var proxy = tabris.create("TestType", {});

      expect(typeof proxy.id).toBe("string");
      expect(proxy.id.length).toBeGreaterThan(0);
    });

    it("creates different widget ids for subsequent calls", function() {
      var proxy1 = tabris.create("TestType", {});
      var proxy2 = tabris.create("TestType", {});

      expect(proxy1.id).not.toEqual(proxy2.id);
    });

    it("returns a proxy object", function() {
      var result = tabris.create("TestType", {});

      expect(result).toEqual(jasmine.any(tabris.Proxy));
    });

    it("triggers a create operation with type and properties", function() {
      var proxy = tabris.create("TestType", {foo: 23});

      var createCall = nativeBridge.calls({op: "create", id: proxy.id})[0];

      expect(createCall.type).toBe("TestType");
      expect(createCall.properties.foo).toBe(23);
    });

    it("executes type translations", function() {
      var proxy = tabris.create("CheckBox", {});

      var createCall = nativeBridge.calls({op: "create", id: proxy.id})[0];

      expect(createCall.type).toBe("rwt.widgets.Button");
    });

  });

  describe("register types", function() {

    it("allows to register a new type", function() {
      var members = {foo: 23};
      tabris.registerType("CustomType", members);
      var instance = tabris.create("CustomType");
      expect(instance).toEqual(jasmine.any(tabris.Proxy));
      expect(instance).toEqual(jasmine.any(tabris.CustomType));
      delete tabris.CustomType;
    });

    it("adds members to new type", function() {
      var members = {foo: 23};
      tabris.registerType("CustomType", members);
      var instance = tabris.create("CustomType");
      expect(instance.foo).toBe(23);
      expect(instance.type).toBe("CustomType");
      delete tabris.CustomType;
    });

    it("calls 'create' with type", function() {
      tabris.registerType("CustomType", {});
      tabris.create("CustomType");

      expect(nativeBridge.calls({op: "create"})[0].type).toBe("CustomType");
      delete tabris.CustomType;
    });

    it("calls 'create' with _type if present", function() {
      tabris.registerType("CustomType", {_type: "foo.Type"});
      tabris.create("CustomType");

      expect(nativeBridge.calls({op: "create"})[0].type).toBe("foo.Type");
      delete tabris.CustomType;
    });

    it("prevents to overwrite already registered types", function() {
      expect(function() {
        tabris.registerType("Button", {});
      }).toThrowError("Type already registered: Button");
    });

    it("adds _trigger to constructor", function() {
      var fn = function() {};
      tabris.registerType("CustomType", {_trigger: {foo: fn}});
      var instance = tabris.create("CustomType");

      expect(instance.constructor._trigger.foo).toBe(fn);
      expect(instance._trigger).toBe(tabris.Proxy.prototype._trigger);
      delete tabris.CustomType;
    });

    it("adds empty trigger map to constructor", function() {
      tabris.registerType("CustomType", {});
      var instance = tabris.create("CustomType");

      expect(instance.constructor._trigger).toEqual({});
      delete tabris.CustomType;
    });

    it("adds _listen to constructor", function() {
      var fn = function() {};
      tabris.registerType("CustomType", {_listen: {foo: fn}});
      var instance = tabris.create("CustomType");

      expect(instance.constructor._listen.foo).toBe(fn);
      expect(instance._listen).toBe(tabris.Proxy.prototype._listen);
      delete tabris.CustomType;
    });

    it("adds empty listen map to constructor", function() {
      tabris.registerType("CustomType", {});
      var instance = tabris.create("CustomType");

      expect(instance.constructor._listen).toEqual({});
      delete tabris.CustomType;
    });

    it("adds _type to constructor", function() {
      tabris.registerType("CustomType", {_type: "foo"});
      var instance = tabris.create("CustomType");

      expect(instance.constructor._type).toBe("foo");
      expect(instance._type).toBeUndefined();
      delete tabris.CustomType;
    });

  });

});
