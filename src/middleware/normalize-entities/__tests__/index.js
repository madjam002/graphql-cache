/* eslint-env mocha */

import {expect} from 'chai'
import gql from 'graphql-tag'
import {cacheQueryResult} from '../../../cache-query-result'
import {cacheKey} from '../../../__tests__/util'
import {normalizeEntities} from '../index'

describe.only('middleware/normalize-entities', function () {

  describe('cacheQueryResult', function () {
    it('should normalize entities in a simple query', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth
          }
        }
      `

      const result = {
        user: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
        },
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
        user: {
          id: '10',
        },
        someOtherUser: {
          id: '10',
        },
      })
    })
  })

})
