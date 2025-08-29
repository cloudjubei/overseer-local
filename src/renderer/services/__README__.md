dependencyResolver
- Initializes once via DependencyResolverBootstrap (rendered in App)
- Listens to tasksService updates and rebuilds its index
- Exposes resolution, validation, reverse dependency graph, and search helpers

Do not call useDependencyResolver() unless you need a local snapshot subscription; the app-wide bootstrap ensures the service is live.
