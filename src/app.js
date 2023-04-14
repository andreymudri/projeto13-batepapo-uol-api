import { MongoClient } from "mongodb";
import express from "express";
import cors from "cors";
import joi from "joi";
import dotenv from "dotenv";
import dayjs from "dayjs";

const app = express();
app.use(express.json());
app.use(cors());

dotenv.config();

let db;
const mongoClient = new MongoClient(process.env.DATABASE_URL);
mongoClient
  .connect()
  .then(() => (db = mongoClient.db()))
  .catch((err) => console.log(err.message));

app.post("/participants", async (req, res) => {
  const participantSchema = joi.object({
    name: joi.string().required(),
  });
  try {
    const { error } = participantSchema.validate(req.body);
    if (error) {
      return res.status(422).json({ error: error.details[0].message });
    }
    const { name } = req.body;
    const existingParticipant = await db
      .collection("participants")
      .findOne({ name });
    if (existingParticipant) {
      return res.status(409).json({ error: "Participant name already in use" });
    }
    const participant = { name, lastStatus: Date.now() };
    await db.collection("participants").insertOne(participant);
    const time = dayjs().format("HH:mm:ss");
    const message = {
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time,
    };
    await db.collection("messages").insertOne(message);
    return res.sendStatus(201);
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray();

    return res.json(participants);
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/messages", async (req, res) => {
  try {
    const { to, text, type } = req.body;
    const from = req.headers.user;

    const schema = joi.object({
      to: joi.string().required(),
      text: joi.string().required(),
      type: joi.string().valid("message", "private_message").required()
    });
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(422).json({ error: error.details[0].message });
    }

    const participant = await db
      .collection("participants")
      .findOne({ name: from });
    if (!participant) {
      return res.status(422).json({ error: "Invalid sender (from)" });
    }

    const time = dayjs().format("HH:mm:ss");
    const message = { from, to, text, type, time };
    await db.collection("messages").insertOne(message);

    return res.sendStatus(201);
  } catch (error) {
    console.log(error.message);
    return res.status(500).send("Internal Server Error");
  }
});

app.get("/messages", async (req, res) => {
  try {
    const user = req.headers.user;
    const limit = parseInt(req.query.limit);

    if (isNaN(limit) || limit <= 0) {
      return res.status(422).send("Invalid limit parameter");
    }

    const messages = db.collection("messages");
    const query = {
      $or: [
        { to: "Todos" },
        { from: user },
        { to: user },
        { type: "public" }
      ]
    };
    const result = await messages
      .find(query)
      .limit(limit)
      .toArray();

    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Internal Server Error");
  }
});


app.post('/status', async (req, res) => {
  const user = req.headers.user;

  if (!user) {
    return res.status(404).send( 'User not found' );
  }

  const participants = db.collection("participants");
  const participantsArray = await participants.find().toArray();
  const participant = participantsArray.find(participant => participant.name === user);
  if (!participant) {
    return res.status(404).send('Participant not found');
  }

  participant.lastStatus = Date.now();

  await participants.updateOne({ _id: participant._id }, { $set: participant });

  return res.sendStatus(200);
});


setInterval(async () => {
  try {
      const participants = await db.collection("participants").find().toArray();
    const currentTime = Date.now();
    const time = dayjs().format("HH:mm:ss");
    const afkParticipants = participants.filter((p) => {
      if ((currentTime - p.lastStatus) >= 10000) {
        return p;
      } else {
        return false;
      }
    });
    console.log(afkParticipants)
      afkParticipants.map(p => {
          db.collection("messages").insertOne({
              from: p.name,
              to: 'Todos',
              text: "sai da sala...",
              type: 'status',
              time
          });
          return p.name;
      });
      const afkParticipantNames = afkParticipants.map(p => p.name);
      await db.collection("participants").deleteMany({ name: { $in: afkParticipantNames } });
  } catch (err) {
      console.log(err);
  }
}, 15000);

const PORT = 5000;
app.listen(PORT, () => console.log(`Server online port ${PORT}.`));