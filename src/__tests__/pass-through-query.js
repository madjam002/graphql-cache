/* eslint-env mocha */

import {expect} from 'chai'
import gql from 'graphql-tag'
import {print} from 'graphql-tag/printer'
import {passThroughQuery} from '../pass-through-query'

function cacheKey(field, args) {
  if (!args) {
    return field
  }

  const stringifiableArgs = {}

  for (const k in args) {
    stringifiableArgs[k] = args[k].toString()
  }

  return `${field}|${JSON.stringify(stringifiableArgs)}`
}

describe('passThroughQuery', function () {

  describe('with fresh cache', function () {
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

      const newQuery = print(passThroughQuery(cache, query)).trim()

      expect(newQuery).to.eql(`{
  user {
    id
    dateOfBirth
  }
}`)
    })

    it('should take a complex query and result and return it in a cached format', function () {
      const query = gql`
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
            relatedFriends { id, name }
            ...Foo
            ...on User {
              interests
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

      const variables = {
        someLimit: 2,
      }

      const cache = {
        user: {
          id: '10',
          name: 'John Smith',
          interests: 'Hi',
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
          relatedFriends: [
            { id: '11', name: 'Person 1' },
            { id: '12' },
            { id: '13', name: 'Person 3' },
          ],
          someOtherConnection: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
          ],
          reallyAnotherConnection: [
            { id: '11', name: 'Person 1' },
          ],
        },
      }

      const newQuery = print(passThroughQuery(cache, query))

      expect(newQuery).to.equal(print(gql`
        query {
          user {
            about
            otherFriendsDynamic: friends(limit: $someLimit) { id, name }
            relatedFriends { name }
            ...Foo
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
      `))
    })
  })

})
