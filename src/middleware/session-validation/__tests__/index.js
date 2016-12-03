/* eslint-env mocha */

import _ from 'lodash'
import {expect} from 'chai'
import gql from 'graphql-tag'
import {print} from 'graphql-tag/printer'
import {cacheQueryResult, passThroughQuery} from '../../../'
import {cacheKey} from '../../../util'
import {sessionValidation} from '../index'

describe('middleware/session-validation', function () {

  describe('cacheQueryResult', function () {
    it('should store the session ID against data in the cache from a simple query', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth

            friends {
              id
              name
            }
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
          friends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
          ],
        },
        otherUser: null,
      }

      const previousCache = {}
      const cache = cacheQueryResult(previousCache, query, result, null, sessionValidation({
        sessionId: 'testid',
      }))

      expect(cache).to.eql({
        user: {
          $$sessionMeta: {
            id: 'testid',
            name: 'testid',
            friends: 'testid',
            dateOfBirth: 'testid',
          },
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          friends: [
            {
              $$sessionMeta: {
                id: 'testid',
                name: 'testid',
              },
              id: '11',
              name: 'Person 1',
            },
            {
              $$sessionMeta: {
                id: 'testid',
                name: 'testid',
              },
              id: '12',
              name: 'Person 2',
            },
          ],
        },
        otherUser: null,
      })
    })

    it('should store the session ID against data in the cache from a simple query with existing cache data', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth

            friends {
              id
              name
            }
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
          friends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
          ],
        },
        otherUser: null,
      }

      const previousCache = {
        user: {
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
          friends: [
            {
              $$sessionMeta: {
                id: 'testid',
                name: 'testid',
                interests: 'testid',
              },
              id: '11',
              name: 'Person 1',
              interests: 'GraphQL',
            },
            {
              $$sessionMeta: {
                id: 'testid',
                name: 'testid',
                interests: 'testid',
              },
              id: '12',
              name: 'Person 2',
              interests: 'GraphQL',
            },
          ],
        },
        otherUser: null,
      }

      const cache = cacheQueryResult(previousCache, query, result, null, sessionValidation({
        sessionId: 'nextsession',
      }))

      expect(cache).to.eql({
        user: {
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
          friends: [
            {
              $$sessionMeta: {
                id: 'nextsession',
                name: 'nextsession',
              },
              id: '11',
              name: 'Person 1',
            },
            {
              $$sessionMeta: {
                id: 'nextsession',
                name: 'nextsession',
              },
              id: '12',
              name: 'Person 2',
            },
          ],
        },
        otherUser: null,
      })
    })

    it('should keep null values in the cache', function () {
      const query = gql`
        query {
          user {
            id
            ...User
            name
          }
        }

        fragment User on User {
          dateOfBirth
          someNullValue
        }
      `

      const result = {
        user: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
        },
      }

      const previousCache = {
        user: {
          $$sessionMeta: {
            id: 'lastsession',
            name: 'lastsession',
            someNullValue: 'lastsession',
            oldData: 'lastsession',
            photo: 'lastsession',
          },
          id: '10',
          name: 'John Smith',
          someNullValue: null,
          oldData: 'hi',
          photo: null,
        },
      }

      const cache = cacheQueryResult(previousCache, query, result, null, sessionValidation({
        sessionId: 'nextsession',
      }))

      expect(cache).to.eql({
        user: {
          $$sessionMeta: {
            id: 'nextsession',
            name: 'nextsession',
            someNullValue: 'lastsession',
            oldData: 'lastsession',
            photo: 'lastsession',
            dateOfBirth: 'nextsession',
          },
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
          someNullValue: null,
          oldData: 'hi',
          photo: null,
        },
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
            dateOfBirth
            about
            ...Foo
            picture { url }
            url
            bestFriend {
              name
              about
              interests
              picture { url }
            }
            friends {
              name
              about
            }
            moreFriends: friends(first: $friendCount) {
              edges {
                node {
                  name
                  about
                }
              }
            }
          }
        }

        fragment Foo on User {
          interests
        }
      `

      const variables = {
        friendCount: 20,
      }

      const cache = {
        user: {
          $$sessionMeta: {
            id: 'mysession',
            name: 'mysession',
            interests: 'mysession',
            about: 'lastsession',
            bestFriend: 'mysession',
            picture: 'lastsession',
            url: 'mysession',
            [cacheKey('friends', { first: 20 })]: 'mysession',
          },
          id: '10',
          name: 'John Smith',
          about: 'I am awesome',
          interests: 'GraphQL',
          dateOfBirth: 'whatever',
          picture: null,
          url: 'http://',
          bestFriend: {
            $$sessionMeta: {
              name: 'mysession',
              about: 'mysession',
              interests: 'lastsession',
              picture: 'lastsession',
            },
            name: 'Person 1',
            about: 'umm',
            interests: 'none',
            picture: {
              url: 'http://',
            },
          },
          friends: [
            {
              $$sessionMeta: {
                name: 'mysession',
                about: 'mysession',
              },
              name: 'Person 2',
              about: 'about me',
            },
            {
              $$sessionMeta: {
                name: 'mysession',
                about: 'lastsession',
              },
              name: 'Person 3',
              about: 'about me', // need to fetch because it's from last session
            },
          ],
          [cacheKey('friends', { first: 20 })]: {
            edges: [
              {
                $$sessionMeta: {
                  node: 'mysession',
                },
                node: {
                  $$sessionMeta: {
                    name: 'mysession',
                    about: 'mysession',
                  },
                  name: 'Person 2',
                  about: 'about me',
                },
              },
            ],
          },
        },
      }

      const oldQuery = _.cloneDeep(query)

      const newQuery = print(passThroughQuery(cache, query, variables, sessionValidation({
        sessionId: 'mysession',
      })))

      expect(query).to.eql(oldQuery) // ensure query wasn't mutated

      expect(newQuery).to.equal(print(gql`
        query {
          user {
            dateOfBirth
            about
            picture { url }
            bestFriend {
              interests
              picture {
                url
              }
            }
            friends {
              name
              about
            }
          }
        }
      `))
    })
  })

})
