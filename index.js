const express = require('express');
const cors = require('cors');
const app = express();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
require('dotenv').config();

// middleware
const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    req.decoded = decoded;
    next();
  })
}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jyvsljn.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    const usersCollection = client.db('artistryDB').collection('users')
    const classCollection = client.db('artistryDB').collection('classes')
    const selectedClassCollection = client.db('artistryDB').collection('selectedClasses')

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      if (user?.role !== 'admin') {
        return res.status(403).send({ error: true, message: 'forbidden access' });
      }
      next();
    }

    // user manegement
    // insert user 
    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }

      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // get all users 
    app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray()
      res.send(result)
    })

    // check admin
    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      console.log('hello')
      try {
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        console.log(user)
        const result = { admin: user?.role === 'admin' };
        res.send(result);
      } catch (error) {
        console.error('Error occurred while querying the database:', error);
        res.status(500).send({ error: 'Internal server error' });
      }
    });

    // check instructor
    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      try {
        const query = { email: email };
        const user = await usersCollection.findOne(query);
        const result = { instructor: user?.role === 'instructor' };
        res.send(result);
      } catch (error) {
        console.error('Error occurred while querying the database:', error);
        res.status(500).send({ error: 'Internal server error' });
      }
    });

    // set admin role 
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    // set instructor role 
    app.patch('/users/instructor/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        }
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    // get all instructors
    app.get('/users/instructors', async (req, res) => {
      const result = await usersCollection.find({ role: 'instructor' }).toArray();
      res.send(result);
    })

    // class manegement 
    //   add a class 
    app.post('/classes', async (req, res) => {
      const classes = req.body
      console.log(classes)
      const result = await classCollection.insertOne(classes)
      res.send(result)
    })

    //   get all class 
    app.get('/classes', async (req, res) => {
      const result = await classCollection.find().toArray()
      res.send(result)
    })

    // set class status approved
    app.patch('/classes/approve/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'approved'
        }
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    // set class status denied
    app.patch('/classes/deny/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'denied'
        }
      };
      const result = await classCollection.updateOne(filter, updateDoc);
      res.send(result)
    })

    // send feedback
    app.patch('/classes/feedback/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const { feedback } = req.body;
    
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            feedback: feedback
          }
        };
    
        const result = await classCollection.updateOne(filter, updateDoc);
        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'Class not found' });
        }
        if (result.modifiedCount > 0) {
          res.json({ modifiedCount: result.modifiedCount });
        } else {
          res.json({ modifiedCount: 0 });
        }
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to update class feedback' });
      }
    });

    // get approved classes 
    app.get('/classes/approve', async (req, res) => {
      console.log('approve')
      try {
        const filter =  { status: 'approved' };
        const classes = await classCollection.find(filter).toArray();
        res.json(classes);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch classes' });
      }
    });

    // insert selected classes 
    app.post('/selected', async (req, res) => {
      const classes = req.body;
      const result = await selectedClassCollection.insertOne(classes);
      res.send(result);
    })

    // get selected classes 
    app.get('/selected', verifyJWT, async (req, res) => {
      const email = req.query.email;

      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(403).send({ error: true, message: 'forbidden access' })
      }

      const query = { email: email };
      const result = await selectedClassCollection.find(query).toArray();
      res.send(result);
    });

    
    
    
    


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Artistry Server is running..')
})

app.listen(port, () => {
  console.log(`Artistry camp is running on port ${port}`)
})