/* eslint-env mocha */

import {expect} from 'chai'
import gql from 'graphql-tag'
import {queryCache} from '../query-cache'
import {cacheKey} from '../util'

describe('queryCache', function () {

  describe('with fresh cache', function () {
    it('should take an empty cache state and query and return nothing', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth
          }
        }
      `

      const cache = {}
      const results = queryCache(cache, query)

      expect(results).to.eql({
        user: null,
      })
    })
  })

  describe('with existing data in cache', function () {
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
        user: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
        },
      }
      const results = queryCache(cache, query)

      expect(results).to.eql({
        user: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
        },
      })
    })

    it('should take a complex query and result and return it in a cached format whilst respecting old cache data', function () {
      const query = gql`
        query($someLimit: Int) {
          user {
            id
            theUserName: name
            myOtherName: name
            about
            myFriends: friends { id, name }
            sameFriends: friends { id, name }
            otherFriends: friends(limit: 10) { id, name }
            otherFriendsDynamic: friends(limit: $someLimit) { id, name }
            relatedFriends { id, name }
            ...Foo
            ...on User {
              interests
              location {
                address
              }
            }
            location {
              longitude
              latitude
            }
            dateOfBirth
          }
        }

        fragment Foo on User {
          someOtherConnection {
            id
            name
          }
          ...Baz
        }

        fragment Bar on User {
          andAnotherConnection {
            id
            name
          }
        }

        fragment Baz on User {
          reallyAnotherConnection {
            id
            name
          }
        }
      `

      const cache = {
        user: {
          id: '10',
          name: 'John Smith',
          about: null,
          interests: 'Woop',
          friends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
          ],
          location: {
            latitude: '50',
            longitude: '2',
            address: 'Hi',
          },
          [cacheKey('friends', { limit: 10 })]: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
            { id: '15', name: 'Person 5' },
            { id: '16', name: 'Person 6' },
          ],
          [cacheKey('friends', { limit: 2 })]: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
          ],
          relatedFriends: null,
          someOtherConnection: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
          ],
          reallyAnotherConnection: [
            { id: '11', name: 'Person 1' },
          ],
          dateOfBirth: '2016-09-20 10:00',
        },
      }

      const variables = {
        someLimit: 2,
      }

      const result = queryCache(cache, query, variables)

      expect(result).to.eql({
        user: {
          id: '10',
          theUserName: 'John Smith',
          myOtherName: 'John Smith',
          about: null,
          interests: 'Woop',
          location: {
            latitude: '50',
            longitude: '2',
            address: 'Hi',
          },
          myFriends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
          ],
          sameFriends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
          ],
          otherFriends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
            { id: '15', name: 'Person 5' },
            { id: '16', name: 'Person 6' },
          ],
          otherFriendsDynamic: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
          ],
          relatedFriends: null,
          someOtherConnection: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
          ],
          reallyAnotherConnection: [
            { id: '11', name: 'Person 1' },
          ],
          dateOfBirth: '2016-09-20 10:00',
        },
      })
    })
  })

  it('should throw an error if using a variable which hasn\'t been defined', function () {
    const query = gql`
      query {
        user(id: $userId) {
          id
          name
          dateOfBirth
        }
      }
    `

    const cache = {
      [cacheKey('user', { id: '3' })]: {
        id: '3',
        name: 'John Smith',
        dateOfBirth: 'not late enough',
      },
    }

    expect(() => queryCache(cache, query, { userId: 3 })).to.throw(
      'simplifyAst(): Undefined variable referenced "userId"',
    )
  })

})
