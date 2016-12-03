/* eslint-env mocha */

import _ from 'lodash'
import {expect} from 'chai'
import gql from 'graphql-tag'
import {print} from 'graphql-tag/printer'
import {cacheQueryResult, passThroughQuery, queryCache} from '../../../'
import {cacheKey} from '../../../util'
import {normalizeEntities} from '../index'

describe('middleware/normalize-entities', function () {

  describe('cacheQueryResult', function () {
    it('should normalize entities in a simple query', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth
          }

          otherUser {
            id
            name
          }
        }
      `

      const result = {
        user: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
        },
        otherUser: null,
      }

      const previousCache = {}
      const cache = cacheQueryResult(previousCache, query, result, null, normalizeEntities)

      expect(cache).to.eql({
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
        },
        user: {
          id: '10',
        },
        otherUser: null,
      })
    })

    it('should normalize entities in a complex query', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth

            friends(first: 3) {
              user {
                id
                name
              }
            }

            otherUsers {
              id
              name
            }

            nestedUser {
              id
              about
            }
          }

          someOtherUser {
            id
            interests
          }
        }
      `

      const result = {
        user: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          friends: [
            {
              user: {
                id: '11',
                name: 'Person 1',
              },
            },
            {
              user: {
                id: '12',
                name: 'Person 2',
              },
            },
          ],
          otherUsers: [
            {
              id: '13',
              name: 'Person 3',
            },
            {
              id: '14',
              name: 'Person 4',
            },
          ],
          nestedUser: {
            id: '10',
            about: 'Same user inside itself.',
          },
        },
        someOtherUser: {
          id: '10',
          interests: 'What?!',
        },
      }

      const previousCache = {}
      const cache = cacheQueryResult(previousCache, query, result, null, normalizeEntities)

      expect(cache).to.eql({
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          interests: 'What?!',
          about: 'Same user inside itself.',
          [cacheKey('friends', { first: 3 })]: [
            { user: { id: '11' } },
            { user: { id: '12' } },
          ],
          otherUsers: [
            { id: '13' },
            { id: '14' },
          ],
          nestedUser: {
            id: '10',
          },
        },
        [cacheKey('node', { id: '11' })]: {
          id: '11',
          name: 'Person 1',
        },
        [cacheKey('node', { id: '12' })]: {
          id: '12',
          name: 'Person 2',
        },
        [cacheKey('node', { id: '13' })]: {
          id: '13',
          name: 'Person 3',
        },
        [cacheKey('node', { id: '14' })]: {
          id: '14',
          name: 'Person 4',
        },
        user: {
          id: '10',
        },
        someOtherUser: {
          id: '10',
        },
      })
    })
  })

  describe('passThroughQuery', function () {
    it('should take a simple cache state with normalized entities and query and remove unnecessary fields', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth
            interests
            about
            location {
              address { street { name } }
            }
          }

          otherUser {
            id
            name
          }
        }
      `

      const cache = {
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          interests: 'Hi',
        },
        user: {
          id: '10',
        },
      }

      const newQuery = print(passThroughQuery(cache, query, null, normalizeEntities))

      expect(newQuery).to.equal(print(gql`
        query {
          user {
            dateOfBirth
            about
            location {
              address { street { name } }
            }
            id
          }
          otherUser {
            id
            name
          }
        }
      `))
    })

    it('should take a simple cache state and query and return null if all data requested is in cache', function () {
      const query = gql`
        query {
          user(id: $userId) {
            id
            name
            dateOfBirth
            friend {
              id
              name
            }
          }
        }
      `

      const variables = { userId: '10' }

      const cache = {
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          friend: {
            id: '11',
          },
        },
        [cacheKey('node', { id: '11' })]: {
          id: '11',
          name: 'Person 1',
        },
        [cacheKey('user', { id: '10' })]: {
          id: '10',
        },
      }

      const newQuery = passThroughQuery(cache, query, variables, normalizeEntities)

      expect(newQuery).to.be.null
    })

    it('should take a simple cache state with normalized entities and query with variables and remove unnecessary fields', function () {
      const query = gql`
        query {
          user(id: $userId) {
            id
            name
            dateOfBirth
            interests
            about
            friend {
              ...Friend
              id
              name
            }
          }

          otherUser {
            id
            name
          }
        }

        fragment Friend on User {
          dateOfBirth
          interests
        }
      `

      const variables = { userId: '10' }

      const cache = {
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          interests: 'Hi',
          friend: {
            id: '11',
          },
        },
        [cacheKey('node', { id: '11' })]: {
          id: '11',
          name: 'Person 1',
          interests: 'GraphQL',
          dateOfBirth: 'someday',
        },
        [cacheKey('user', { id: '10' })]: {
          id: '10',
        },
      }

      const newQuery = print(passThroughQuery(cache, query, variables, normalizeEntities))

      expect(newQuery).to.equal(print(gql`
        query {
          user(id: $userId) {
            dateOfBirth
            about
            id
          }
          otherUser {
            id
            name
          }
        }
      `))
    })

    it('should take a cache state and query with fragments and remove unnecessary fields', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth
            interests
            ...User
            about
          }

          otherUser {
            id
            name
          }
        }

        fragment User on User {
          tags {
            primary { name }
            secondary { name }
          }
        }
      `

      const cache = {
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          interests: 'Hi',
        },
        user: {
          id: '10',
        },
      }

      const newQuery = print(passThroughQuery(cache, query, null, normalizeEntities))

      expect(newQuery).to.equal(print(gql`
        query {
          user {
            dateOfBirth
            ...User
            about
            id
          }
          otherUser {
            id
            name
          }
        }

        fragment User on User {
          tags {
            primary { name }
            secondary { name }
          }
        }
      `))
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
        [cacheKey('node', { id: '1' })]: {
          id: '1',
          __typename: 'Plant',
          name: 'Conifer',
          colour: 'green',
        },
        [cacheKey('node', { id: '2' })]: {
          id: '2',
          __typename: 'Grass',
          type: 'unknown',
        },
        [cacheKey('node', { id: '3' })]: {
          id: '3',
          __typename: 'Insect',
          name: 'Bee',
          speed: 13,
        },
        [cacheKey('node', { id: '4' })]: {
          id: '4',
          __typename: 'Insect',
          name: 'Wasp',
        },
        feed: {
          items: [
            { id: '1' },
            { id: '2' },
            { id: '3' },
            { id: '4' },
          ],
        },
      }

      const newQuery = print(passThroughQuery(cache, query, null, normalizeEntities))

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

    it('should take a complex cache state with normalized entities and query and remove unnecessary fields', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth

            friends(first: 3) {
              user {
                id
                name
              }
            }

            otherUsers {
              id
              name
            }

            nestedUser {
              id
              about
              foo
            }
          }

          someOtherUser {
            id
            interests
          }
        }
      `

      const cache = {
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          interests: 'What?!',
          foo: 'bar',
          [cacheKey('friends', { first: 3 })]: [
            { user: { id: '11' } },
            { user: { id: '12' } },
          ],
          otherUsers: [
            { id: '13' },
            { id: '14' },
          ],
          nestedUser: {
            id: '10',
          },
        },
        [cacheKey('node', { id: '11' })]: {
          id: '11',
          name: 'Person 1',
        },
        [cacheKey('node', { id: '12' })]: {
          id: '12',
          // name is missing!!
        },
        [cacheKey('node', { id: '13' })]: {
          id: '13',
          name: 'Person 3',
        },
        [cacheKey('node', { id: '14' })]: {
          id: '14',
          name: 'Person 4',
        },
        user: {
          id: '10',
        },
        someOtherUser: {
          id: '10',
        },
      }

      const oldQuery = _.cloneDeep(query)

      const newQuery = print(passThroughQuery(cache, query, null, normalizeEntities))

      expect(query).to.eql(oldQuery) // ensure query wasn't mutated

      expect(newQuery).to.equal(print(gql`
        query {
          user {
            friends(first: 3) {
              user {
                name
                id
              }
            }

            nestedUser {
              about
              id
            }

            id
          }
        }
      `))
    })

    it('should take a complex cache state and query with fragments and arrays and remove unnecessary fields', function () {
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
              friends { id, name, tags { name } }
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
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          interests: null,
          friends: [
            { id: '11' },
            { id: '12' },
            { id: '13' },
            { id: '14' },
          ],
          [cacheKey('friends', { limit: 10 })]: [
            { id: '11' },
            { id: '12' },
            { id: '13' },
            { id: '14' },
            { id: '15' },
            { id: '16' },
          ],
          [cacheKey('friends', { limit: 3 })]: null,
          relatedFriends: [
            { id: '11' },
            { id: '12' },
            { id: '13' },
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
        [cacheKey('node', { id: '11' })]: {
          id: '11', name: 'Person 1',
          [cacheKey('friends', { limit: 1 })]: [
            { id: '12', name: 'Person 2' },
          ],
          interests: 'Some',
        },
        [cacheKey('node', { id: '12' })]: {
          id: '12', name: 'Person 2',
          [cacheKey('friends', { limit: 1 })]: [
            { id: '11' },
          ],
          interests: 'Some',
        },
        [cacheKey('node', { id: '13' })]: {
          id: '13', name: 'Person 3',
          [cacheKey('friends', { limit: 1 })]: [
            { id: '11' },
          ],
          interests: 'Some',
        },
        [cacheKey('node', { id: '14' })]: {
          id: '14', name: 'Person 4',
        },
        [cacheKey('node', { id: '15' })]: {
          id: '15', name: 'Person 5',
        },
        [cacheKey('node', { id: '16' })]: {
          id: '16', name: 'Person 6',
        },
        user: {
          id: '10',
        },
      }

      const newQuery = print(passThroughQuery(cache, query, variables, normalizeEntities))

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
              friends(limit: $justOne) { name, id }
              ...Another
              ...AndAnother
            }
            ...Foo
            dateOfBirth
            id
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

  describe('queryCache', function () {
    it('should take a simple cache state and query and return the correct data', function () {
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
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
        },
        user: {
          id: '10',
        },
      }
      const results = queryCache(cache, query, null, normalizeEntities)

      expect(results).to.eql({
        user: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
        },
      })
    })

    it('should take a complex cache state and query and return the correct data', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth

            friends(first: 3) {
              user {
                id
                name
              }
            }

            nestedUser {
              id
              about
            }

            otherUsers {
              id
              name
            }
          }

          someOtherUser {
            id
            interests
          }
        }
      `

      const cache = {
        [cacheKey('node', { id: '10' })]: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          interests: 'What?!',
          about: 'Same user inside itself.',
          [cacheKey('friends', { first: 3 })]: [
            { user: { id: '11' } },
            { user: { id: '12' } },
          ],
          otherUsers: [
            { id: '13' },
            { id: '14' },
          ],
          nestedUser: {
            id: '10',
          },
        },
        [cacheKey('node', { id: '11' })]: {
          id: '11',
          name: 'Person 1',
        },
        [cacheKey('node', { id: '12' })]: {
          id: '12',
          name: 'Person 2',
        },
        [cacheKey('node', { id: '13' })]: {
          id: '13',
          name: 'Person 3',
        },
        [cacheKey('node', { id: '14' })]: {
          id: '14',
          name: 'Person 4',
        },
        user: {
          id: '10',
        },
        someOtherUser: {
          id: '10',
        },
      }

      const results = queryCache(cache, query, null, normalizeEntities)

      expect(results).to.eql({
        user: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          friends: [
            {
              user: {
                id: '11',
                name: 'Person 1',
              },
            },
            {
              user: {
                id: '12',
                name: 'Person 2',
              },
            },
          ],
          otherUsers: [
            {
              id: '13',
              name: 'Person 3',
            },
            {
              id: '14',
              name: 'Person 4',
            },
          ],
          nestedUser: {
            id: '10',
            about: 'Same user inside itself.',
          },
        },
        someOtherUser: {
          id: '10',
          interests: 'What?!',
        },
      })
    })
  })

})
