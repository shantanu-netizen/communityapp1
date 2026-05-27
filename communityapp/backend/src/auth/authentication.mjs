import jwt from 'jsonwebtoken'
import { JWT_SECRET } from '../../config.mjs'

/**
 * Verifies Bearer token and attaches payload to req.user.
 * JWT must be signed with sync verify (callback form does not return decoded payload).
 */
const authenticate = (req, res, next) => {
    try {
        const header = req.headers.authorization
        if (!header) {
            return res.status(401).send({ message: 'Unauthorized' })
        }
        const parts = header.split(' ')
        const token = parts.length === 2 ? parts[1] : null
        if (!token) {
            return res.status(401).send({ message: 'Unauthorized' })
        }
        const decoded = jwt.verify(token, JWT_SECRET)
        req.user = decoded
        next()
    } catch (error) {
        return res.status(401).send({ message: 'Please login to access this resource' })
    }
}

const authorisation = (req, res, next) => {
    try {
        const userId = req.params.userId
        const username = req.params.username
        if (userId !== req.user.id || username !== req.user.username) {
            return res.status(401).send({ message: 'Unauthorized' })
        }
        next()
    } catch (error) {
        return res.status(500).send({ message: 'Internal server error' })
    }
}

export { authenticate, authorisation }
