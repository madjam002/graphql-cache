/* eslint-env mocha */

import {expect} from 'chai'
import gql from 'graphql-tag'
import {print} from 'graphql-tag/printer'
import {passThroughQuery} from '../pass-through-query'
import {cacheKey} from '../util'

describe('passThroughQuery', function () {

  it('should take a simple cache state and query and remove unnecessary fields', function () {
    const query = gql`
      query {
        user {
          id
          name
          dateOfBirth
        }
      }
    `

    const cache = {
      user: {
        name: 'John Smith',
      },
    }

    const newQuery = print(passThroughQuery(cache, query))

    expect(newQuery).to.equal(print(gql`
      query {
        user {
          id
          dateOfBirth
        }
      }
    `))
  })

  it('should take a simple cache state and query and return null if all data requested is in cache', function () {
    const query = gql`
      query {
        user {
          id
          name
          dateOfBirth
        }
      }
    `

    const cache = {
      user: {
        id: '10',
        name: 'John Smith',
        dateOfBirth: '2016-09-20 10:00',
      },
    }

    const newQuery = passThroughQuery(cache, query)

    expect(newQuery).to.be.null
  })

  it('should take a query with an array which requests fields which are already in the cache', function () {
    const query = gql`
      query {
        user {
          id
          name
          friends {
            id
            name
          }
        }
      }
    `

    const cache = {
      user: {
        id: '10',
        friends: [
          { id: '11', name: 'Foo bar' },
          { id: '12', name: 'Jane Smith' },
        ],
      },
    }

    const newQuery = print(passThroughQuery(cache, query))

    expect(newQuery).to.equal(print(gql`
      query {
        user {
          name
        }
      }
    `))
  })

  it('should take a query with an array which requests more fields that aren\'t in the cache', function () {
    const query = gql`
      query {
        user {
          id
          friends {
            id
            name
            dateOfBirth
          }
        }
      }
    `

    const cache = {
      user: {
        id: '10',
        friends: [
          { id: '11', name: 'Foo bar' },
          { id: '12', name: 'Jane Smith' },
        ],
      },
    }

    const newQuery = print(passThroughQuery(cache, query))

    expect(newQuery).to.equal(print(gql`
      query {
        user {
          # request all fields again because there might be more records returned from the server
          # and we'll need all of the fields for those records
          friends {
            id
            name
            dateOfBirth
          }
        }
      }
    `))
  })

  it('should take a simple cache state and query with fragments and return null if all data requested is in cache', function () {
    const query = gql`
      query($userId: ID!) {
        user {
          id
          name
          dateOfBirth
          ...someFragment
        }
      }

      fragment someFragment on User {
        name
        dateOfBirth
      }
    `

    const cache = {
      user: {
        id: '10',
        name: 'John Smith',
        dateOfBirth: '2016-09-20 10:00',
      },
    }

    const newQuery = print(passThroughQuery(cache, query))

    expect(newQuery).to.be.null
  })

  it('should take a simple cache state and query and remove unnecessary fields with fragments on an interface', function () {
    const query = gql`
      query {
        feed {
          items {
            id
            __typename
            ...PlantItem
            ...InsectItem
            ...on Grass {
              type
            }
          }
        }
      }

      fragment PlantItem on Plant {
        name
        colour
      }

      fragment InsectItem on Insect {
        name
        speed
      }
    `

    const cache = {
      feed: {
        items: [
          {
            id: '1',
            __typename: 'Plant',
            name: 'Conifer',
            colour: 'green',
          },
          {
            id: '2',
            __typename: 'Grass',
            type: 'unknown',
          },
          {
            id: '3',
            __typename: 'Insect',
            name: 'Bee',
            speed: 13,
          },
          {
            id: '4',
            __typename: 'Insect',
            name: 'Wasp',
          },
        ],
      },
    }

    const newQuery = print(passThroughQuery(cache, query))

    expect(newQuery).to.equal(print(gql`
      query {
        feed {
          items {
            id
            __typename
            ...PlantItem
            ...InsectItem
            ...on Grass {
              type
            }
          }
        }
      }

      fragment PlantItem on Plant {
        name
        colour
      }

      fragment InsectItem on Insect {
        name
        speed
      }
    `))
  })

  it('should take a simple cache state and return null with fragments on an interface with all data already in cache', function () {
    const query = gql`
      query {
        feed {
          items {
            id
            __typename
            ...PlantItem
            ...InsectItem
            ...on Grass {
              type
            }
          }
        }
      }

      fragment PlantItem on Plant {
        name
        colour
      }

      fragment InsectItem on Insect {
        name
        speed
      }
    `

    const cache = {
      feed: {
        items: [
          {
            id: '1',
            __typename: 'Plant',
            name: 'Conifer',
            colour: 'green',
          },
          {
            id: '2',
            __typename: 'Grass',
            type: 'unknown',
          },
          {
            id: '3',
            __typename: 'Insect',
            name: 'Bee',
            speed: 13,
          },
          {
            id: '4',
            __typename: 'Insect',
            name: 'Wasp',
            speed: 14,
          },
        ],
      },
    }

    const newQuery = print(passThroughQuery(cache, query))

    expect(newQuery).to.be.null
  })

  it('should remove unused variables', function () {
    const query = gql`
      query($userId: ID!, $eventId: ID!, $count: Int!) {
        user(id: $userId) {
          id
          name
        }

        event(id: $eventId) {
          name
          ...Event
        }
      }

      fragment Event on Event {
        picture { url }
        going(first: $count) {
          name
        }
      }
    `

    const cache = {
      [cacheKey('user', { id: '10' })]: {
        id: '10',
        name: 'John Smith',
      },
    }

    const variables = { userId: '10', eventId: '11', count: '30' }

    const newQuery = print(passThroughQuery(cache, query, variables))

    expect(newQuery).to.equal(print(gql`
      query($eventId: ID!, $count: Int!) {
        event(id: $eventId) {
          name
          ...Event
        }
      }

      fragment Event on Event {
        picture { url }
        going(first: $count) {
          name
        }
      }
    `))
  })

  it('should take a complex query and result and return it in a cached format', function () {
    const query = gql`
      fragment Bar on User {
        andAnotherConnection {
          id
          name
        }
      }

      fragment Foo on User {
        someOtherConnection {
          id
          name
        }
        ...Baz
      }

      query {
        user {
          id
          theUserName: name
          myOtherName: name
          about
          myFriends: friends { id, name }
          sameFriends: friends { id, name }
          otherFriends: friends(limit: 10) { id, name }
          otherFriendsDynamic: friends(limit: $someLimit) { id, name }
          moreFriendsDynamic: friends(limit: $someOtherLimit) { id, name }
          relatedFriends {
            id
            name
            friends(limit: $justOne) { name }
            ...Another
            ...AndAnother
          }
          ...Foo
          ...on User {
            interests
          }
          bestFriend {
            friends { id, name }
          }
          dateOfBirth
        }
      }

      fragment Baz on User {
        reallyAnotherConnection {
          id
          name
        }
      }

      fragment Another on User {
        about
        interests
      }

      fragment AndAnother on User {
        id
      }
    `

    const variables = {
      justOne: 1,
      someLimit: 2,
      someOtherLimit: 3,
    }

    const cache = {
      user: {
        id: '10',
        name: 'John Smith',
        interests: null,
        friends: [
          { id: '11', name: 'Person 1' },
          { id: '12', name: 'Person 2' },
          { id: '13', name: 'Person 3' },
          { id: '14', name: 'Person 4' },
        ],
        [cacheKey('friends', { limit: 10 })]: [
          { id: '11', name: 'Person 1' },
          { id: '12', name: 'Person 2' },
          { id: '13', name: 'Person 3' },
          { id: '14', name: 'Person 4' },
          { id: '15', name: 'Person 5' },
          { id: '16', name: 'Person 6' },
        ],
        [cacheKey('friends', { limit: 3 })]: null,
        relatedFriends: [
          {
            id: '11',
            name: 'Person 1',
            [cacheKey('friends', { limit: 1 })]: [
              { id: '12', name: 'Person 2' },
            ],
            interests: 'Some',
          },
          {
            id: '12',
            // This friend doesn't have a name, so we need to fetch name field
            [cacheKey('friends', { limit: 1 })]: [
              { id: '11', name: 'Person 1' },
            ],
            interests: 'Some',
          },
          {
            id: '13',
            name: 'Person 3',
            [cacheKey('friends', { limit: 1 })]: [
              { id: '11', name: 'Person 1' },
            ],
            interests: 'Some',
          },
        ],
        someOtherConnection: [
          { name: 'Person 1' },
          { name: 'Person 2' },
        ],
        reallyAnotherConnection: [
          { id: '20' },
        ],
        bestFriend: {
          friends: [],
        },
      },
    }

    const newQuery = print(passThroughQuery(cache, query, variables))

    expect(newQuery).to.equal(print(gql`
      fragment Foo on User {
        someOtherConnection {
          id
          name
        }
        ...Baz
      }

      query {
        user {
          about
          otherFriendsDynamic: friends(limit: $someLimit) { id, name }
          relatedFriends {
            id
            name
            friends(limit: $justOne) { name }
            ...Another
            ...AndAnother
          }
          ...Foo
          dateOfBirth
        }
      }

      fragment Baz on User {
        reallyAnotherConnection {
          id
          name
        }
      }

      fragment Another on User {
        about
        interests
      }

      fragment AndAnother on User {
        id
      }
    `))
  })

})
