import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLNonNull,
  GraphQLID,
  GraphQLString,
  GraphQLInt,
  GraphQLList,
  GraphQLBoolean,
} from 'graphql'

const User = new GraphQLObjectType({
  name: 'User',
  fields: () => ({
    id: {
      type: new GraphQLNonNull(GraphQLID),
    },
    name: {
      type: GraphQLString,
    },
    dateOfBirth: {
      type: GraphQLString,
    },
    about: {
      type: GraphQLString,
    },
    interests: {
      type: GraphQLString,
    },
    friends: {
      type: new GraphQLList(User),
      args: {
        limit: {
          type: GraphQLInt,
        },
      },
    },
    relatedFriends: {
      type: new GraphQLList(User),
    },
    someOtherConnection: {
      type: new GraphQLList(User),
    },
    andAnotherConnection: {
      type: new GraphQLList(User),
    },
    reallyAnotherConnection: {
      type: new GraphQLList(User),
    },
  }),
})

const Todo = new GraphQLObjectType({
  name: 'Todo',
  fields: () => ({
    id: {
      type: new GraphQLNonNull(GraphQLID),
    },
    label: {
      type: GraphQLString,
    },
    completed: {
      type: GraphQLBoolean,
    },
    author: {
      type: User,
    },
  }),
})

const TodoEdge = new GraphQLObjectType({
  name: 'TodoEdge',
  fields: () => ({
    node: {
      type: Todo,
    },
    cursor: {
      type: GraphQLString,
    },
  }),
})

const TodosConnection = new GraphQLObjectType({
  name: 'TodosConnection',
  fields: () => ({
    totalCount: {
      type: GraphQLInt,
    },
    edges: {
      type: new GraphQLList(TodoEdge),
    },
  }),
})

const query = new GraphQLObjectType({
  name: 'Query',
  fields: () => ({
    todos: {
      type: TodosConnection,
    },
    isLoggedIn: {
      type: GraphQLBoolean,
    },
    user: {
      type: User,
    },
    currentTime: {
      type: GraphQLString,
    },
  }),
})

export default new GraphQLSchema({
  query,
})
