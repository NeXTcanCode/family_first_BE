# Backend — Family Comes First

Node/Express + Mongoose API, separate project from `frontend/`. Auth via JWT stored in an httpOnly cookie.

## Folder structure

```
backend/
  package.json  .env  .env.example  .gitignore
  server.js                 # creates http.Server, wraps express app, attaches socket.io, listens
  src/
    app.js                  # express app: middleware, route mounts (exported, no listen)
    config/
      db.js                 # mongoose.connect()
    models/
      User.js
      Family.js
    middleware/
      auth.js                # verifyJwtCookie — reads req.cookies.token, verifies, attaches req.user
      errorHandler.js         # centralized error -> JSON response
      validate.js              # wraps express-validator result check
    controllers/
      authController.js       # signup, login, logout, me
      familyController.js     # createFamily, getMyFamilies, getFamily, addMember
      userController.js       # lookupByEmail (for add-member), updateLocation
    routes/
      authRoutes.js
      familyRoutes.js
      userRoutes.js
    validators/
      authValidators.js
      familyValidators.js
      userValidators.js
    utils/
      jwt.js                 # signToken, cookie options helper
      asyncHandler.js
    sockets/
      index.js               # initSocket(io) — handshake auth, room join logic
      events.js               # exported event-name constants
```

## npm packages

| Package | Purpose |
|---|---|
| `express` | HTTP framework |
| `mongoose` | MongoDB ODM / schema modeling |
| `bcryptjs` | password hashing (pure JS, no native build step) |
| `jsonwebtoken` | sign/verify JWTs |
| `cookie-parser` | parse the httpOnly cookie off incoming requests |
| `cors` | cross-origin config between Vite dev server and API, with credentials |
| `dotenv` | load `.env` |
| `express-validator` | request body validation |
| `morgan` | request logging (dev) |
| `socket.io` | real-time notifications |
| `nodemon` (dev) | restart on file change |

## Mongoose schemas

### User (`models/User.js`)
- `firstName: String, required`
- `middleName: String` (optional)
- `lastName: String, required`
- `email: String, required, unique, lowercase, trim`
- `passwordHash: String, required`
- `lastLocation: { lat: Number, lng: Number }`
- `locationUpdatedAt: Date`
- `timestamps: true`

### Family (`models/Family.js`)
- `name: String, required` (uniqueness not required)
- `creator: { type: ObjectId, ref: 'User', required: true }`
- `members: [{ type: ObjectId, ref: 'User' }]` — creator is included as a member on creation
- `timestamps: true`

**Membership rule**: many-to-many via `Family.members` (not stored on User, so adding someone never requires writing to their own document). `MAX_FAMILY_MEMBERS = 4` is an application-level constant enforced in `familyController.addMember`: re-fetch the family, reject with 4xx if `members.length >= 4` or the target user is already a member, before pushing.

## API endpoints

| Method | Path | Purpose | Auth |
|---|---|---|---|
| POST | `/api/auth/signup` | create user, hash password, set JWT cookie | public |
| POST | `/api/auth/login` | verify credentials, set JWT cookie | public |
| POST | `/api/auth/logout` | clear cookie | public |
| GET | `/api/auth/me` | return current user from JWT | protected |
| GET | `/api/users/lookup?email=` | find user by email (id + name only) for add-member form | protected |
| PATCH | `/api/users/me/location` | update `lastLocation` + `locationUpdatedAt` for current user | protected |
| POST | `/api/families` | create family (creator = req.user, members = [creator]) | protected |
| GET | `/api/families` | list families current user belongs to, members populated | protected |
| GET | `/api/families/:id` | get one family, populated | protected (must be member) |
| POST | `/api/families/:id/members` | add member by email | protected + creator-only + cap/dup checks |

Cookie: name `token`, `httpOnly: true`, `sameSite: 'lax'`, `secure: NODE_ENV === 'production'`, `maxAge` matching JWT expiry.

## JWT cookie flow

1. Signup/login: `jwt.sign({ userId }, JWT_SECRET, { expiresIn })` → `res.cookie('token', ..., {...options})` → respond with user JSON (never the raw token in the body).
2. Every protected route runs `middleware/auth.js`: reads `req.cookies.token` (via `cookie-parser`), `jwt.verify`s it, attaches `req.user = { id }`, else responds `401`.
3. CORS: `cors({ origin: process.env.CLIENT_ORIGIN, credentials: true })` — must be an exact origin (e.g. `http://localhost:5173`), never `*`, because credentialed requests disallow wildcard origins.
4. Socket.IO handshake reuses the same cookie (see below) — no separate socket login step.

## Socket.IO plan (server side)

One shared `io` instance wraps the same HTTP server as Express (`server.js`). A socket middleware (`sockets/index.js`) parses `socket.handshake.headers.cookie`, extracts `token`, `jwt.verify`s it, attaches `socket.userId`, and rejects the connection (`next(new Error('unauthorized'))`) if invalid. Socket.IO CORS config mirrors Express: explicit origin + `credentials: true`.

**Rooms**: on connect, look up the user's families (`Family.find({ members: socket.userId })`) and join `user:<userId>` (personal) plus `family:<familyId>` for each family they belong to.

| Event | Payload | Trigger / Room |
|---|---|---|
| `member:added` | `{ familyId, member: {id, firstName, lastName} }` | emitted to `user:<newMemberId>` and `family:<familyId>` when `addMember` succeeds |
| `location:updated` | `{ familyId, userId, lastLocation, locationUpdatedAt }` | emitted to every `family:<familyId>` the updating user belongs to, after the location PATCH succeeds |
| `family:created` | `{ family }` | optional, emitted to `user:<creatorId>` for cross-tab sync |

## Build order

1. Scaffold + DB connection + models + health-check route. Verify: server boots, connects to Mongo.
2. Auth routes + middleware + validators. Verify via curl/Postman: signup sets cookie, `/me` returns user with cookie, 401 without.
3. Family routes: create/list/get/add-member (cap + creator-only + dup checks) + `users/lookup`. Verify via curl/Postman with two seeded users.
4. Location PATCH endpoint. Verify persistence via curl/Postman.
5. Socket.IO: handshake auth, room joins, event emission on add-member and location update. Verify with two concurrent socket connections.
6. `errorHandler.js` for a consistent JSON error shape across all endpoints.
