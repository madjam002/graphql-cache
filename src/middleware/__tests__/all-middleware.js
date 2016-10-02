/* eslint-env mocha */

import _ from 'lodash'
import {expect} from 'chai'
import gql from 'graphql-tag'
import {print} from 'graphql-tag/printer'
import {cacheQueryResult, passThroughQuery} from '../../'
import {cacheKey} from '../../util'
import {normalizeEntities} from '../normalize-entities'
import {sessionValidation} from '../session-validation'

describe('all middleware combined', function () {

  describe('cacheQueryResult', function () {
    it('should store the session ID against data in the cache from a simple query with existing cache data', function () {
      const query = gql`
        query($limit: Int) {
          user {
            id
            name
            dateOfBirth

            friends(first: $limit) {
              id
              name
            }
          }

          otherUser {
            id
            name
          }

          feed(first: $limit) {
            id
            ...User
            ...Place
          }
        }

        fragment User on User {
          name
          picture { url }
        }

        fragment Place on Place {
          name
          about
        }
      `

      const variables = { limit: 10 }

      const result = {
        user: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          friends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
          ],
        },
        feed: [
          { id: '15', name: 'Person 5', picture: { url: 'http://' } },
          { id: '16', name: 'Some place!', about: 'This place is awesome' },
        ],
        otherUser: null,
      }

      const previousCache = {
        [cacheKey('node', { id: '10' })]: {
          $$sessionMeta: {
            id: 'testid',
            name: 'testid',
            friends: 'testid',
            dateOfBirth: 'testid',
            interests: 'testid',
          },
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          interests: 'GraphQL',
          [cacheKey('friends', { first: 9 })]: [
            {
              id: '11',
            },
            {
              id: '12',
            },
          ],
        },
        [cacheKey('node', { id: '11' })]: {
          $$sessionMeta: {
            id: 'testid',
            name: 'testid',
            interests: 'testid',
          },
          id: '11',
          name: 'Person 1',
          interests: 'GraphQL',
        },
        [cacheKey('node', { id: '12' })]: {
          $$sessionMeta: {
            id: 'testid',
            name: 'testid',
            interests: 'testid',
          },
          id: '12',
          name: 'Person 2',
          interests: 'GraphQL',
        },
        [cacheKey('node', { id: '15' })]: {
          $$sessionMeta: {
            id: 'testid',
            name: 'testid',
            about: 'testid',
            picture: 'testid',
          },
          id: '15',
          name: 'Person 5',
          about: 'I\'m awesome',
          picture: {
            $$sessionMeta: {
              url: 'testid',
            },
            url: 'http://',
          },
        },
        [cacheKey('node', { id: '16' })]: {
          $$sessionMeta: {
            id: 'testid',
            name: 'testid',
            about: 'testid',
            picture: 'testid',
          },
          id: '16',
          name: 'Some place!',
          about: 'This place is awesome',
          picture: {
            $$sessionMeta: {
              url: 'testid',
            },
            url: 'http://',
          },
        },
        user: {
          id: '10',
        },
        [cacheKey('feed', { first: 10 })]: [
          { id: '15' },
          { id: '16' },
        ],
        otherUser: null,
      }

      const cache = cacheQueryResult(previousCache, query, result, variables, sessionValidation({
        sessionId: 'nextsession',
      }), normalizeEntities)

      expect(cache).to.eql({
        [cacheKey('node', { id: '10' })]: {
          $$sessionMeta: {
            id: 'nextsession',
            name: 'nextsession',
            friends: 'nextsession',
            dateOfBirth: 'nextsession',
            interests: 'testid',
          },
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          interests: 'GraphQL',
          [cacheKey('friends', { first: 9 })]: [
            {
              id: '11',
            },
            {
              id: '12',
            },
          ],
          [cacheKey('friends', { first: 10 })]: [
            {
              id: '11',
            },
            {
              id: '12',
            },
          ],
        },
        [cacheKey('node', { id: '11' })]: {
          $$sessionMeta: {
            id: 'nextsession',
            name: 'nextsession',
            interests: 'testid',
          },
          id: '11',
          name: 'Person 1',
          interests: 'GraphQL',
        },
        [cacheKey('node', { id: '12' })]: {
          $$sessionMeta: {
            id: 'nextsession',
            name: 'nextsession',
            interests: 'testid',
          },
          id: '12',
          name: 'Person 2',
          interests: 'GraphQL',
        },
        [cacheKey('node', { id: '15' })]: {
          $$sessionMeta: {
            id: 'nextsession',
            name: 'nextsession',
            about: 'testid',
            picture: 'nextsession',
          },
          id: '15',
          name: 'Person 5',
          about: 'I\'m awesome',
          picture: {
            $$sessionMeta: {
              url: 'nextsession',
            },
            url: 'http://',
          },
        },
        [cacheKey('node', { id: '16' })]: {
          $$sessionMeta: {
            id: 'nextsession',
            name: 'nextsession',
            about: 'nextsession',
            picture: 'testid',
          },
          id: '16',
          name: 'Some place!',
          about: 'This place is awesome',
          picture: {
            $$sessionMeta: {
              url: 'testid',
            },
            url: 'http://',
          },
        },
        user: {
          id: '10',
        },
        [cacheKey('feed', { first: 10 })]: [
          { id: '15' },
          { id: '16' },
        ],
        otherUser: null,
      })
    })
  })

  describe('passThroughQuery', function () {
    it('should request fields which are present in cache from another session', function () {
      const query = gql`
        query {
          user {
            id
            name
            about
            friends {
              edges {
                node {
                  id
                  name
                  about
                }
              }
            }
            moreFriends: friends(first: $friendCount) {
              edges {
                node {
                  id
                  name
                  about
                  picture { url }
                }
              }
            }
          }
        }
      `

      const variables = {
        friendCount: 20,
      }

      const cache = {
        [cacheKey('node', { id: '10' })]: {
          $$sessionMeta: {
            id: 'mysession',
            name: 'mysession',
            friends: 'mysession',
            [cacheKey('friends', { first: 20 })]: 'mysession',
          },
          id: '10',
          name: 'John Smith',
          about: 'I am awesome',
          friends: {
            $$sessionMeta: {
              edges: 'mysession',
            },
            edges: [
              {
                $$sessionMeta: {
                  node: 'mysession',
                },
                node: {
                  id: '11',
                },
              },
            ],
          },
          [cacheKey('friends', { first: 20 })]: {
            $$sessionMeta: {
              edges: 'lastsession',
            },
            edges: [
              {
                $$sessionMeta: {
                  node: 'mysession',
                },
                node: {
                  id: '12',
                },
              },
            ],
          },
        },
        [cacheKey('node', { id: '11' })]: {
          $$sessionMeta: {
            name: 'mysession',
            about: 'mysession',
          },
          id: '11',
          name: 'Person 1',
          about: 'about me',
        },
        [cacheKey('node', { id: '12' })]: {
          $$sessionMeta: {
            name: 'mysession',
            about: 'lastsession',
            picture: 'lastsession',
          },
          id: '12',
          name: 'Person 2',
          about: 'about me',
          picture: null,
        },
        user: {
          id: '10',
        },
      }

      const oldQuery = _.cloneDeep(query)

      const newQuery = print(passThroughQuery(cache, query, variables, sessionValidation({
        sessionId: 'mysession',
      }), normalizeEntities))

      expect(query).to.eql(oldQuery) // ensure query wasn't mutated

      expect(newQuery).to.equal(print(gql`
        query {
          user {
            about
            friends {
              edges {
                node {
                  id
                }
              }
            }
            moreFriends: friends(first: $friendCount) {
              edges {
                node {
                  id
                  about
                  picture { url }
                }
              }
            }
            id
          }
        }
      `))
    })
  })

})
