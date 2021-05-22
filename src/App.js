import React, { useCallback, useEffect, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Alert from "react-bootstrap/Alert";

import { drawShape } from "./draw";
import { getInference, loadModelPromise } from "./model";
import { CANVAS_SIZE, IMAGE_SIZE, COLOR_NAMES, SHAPES } from "./constants";
import { randint } from "./utils";

import "bootstrap/dist/css/bootstrap.min.css";
import Col from "react-bootstrap/Col";
import Row from "react-bootstrap/Row";
import "./App.css";

const SAMPLE_QUESTIONS = [
  "What color is the shape?",
  "Is there a blue shape in the image?",
  "Is there a red shape?",
  "Is there a green shape in the image?",
  "Is there a black shape?",
  "Is there not a teal shape in the image?",
  "Does the image contain a rectangle?",
  "Does the image not contain a circle?",
  "What shape is present?",
  "Is no triangle present?",
  "Is a circle present?",
  "Is a rectangle present?",
  "Is there a triangle?",
  "What is the color of the shape?",
  "What shape does the image contain?",
];

const randomQuestion = () =>
  SAMPLE_QUESTIONS[randint(0, SAMPLE_QUESTIONS.length - 1)];

const urlParams = new URLSearchParams(window.location.search);
const isEmbedded = urlParams.has("embed");

function App() {
  const [color, setColor] = useState(null);
  const [shape, setShape] = useState(null);
  const [question, setQuestion] = useState(randomQuestion());
  const [answer, setAnswer] = useState(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [predicting, setPredicting] = useState(false);

  const mainCanvas = useRef(null);
  const smallCanvas = useRef(null);

  const onPredict = useCallback(() => {
    setPredicting(true);
  }, [setPredicting]);

  useEffect(() => {
    if (smallCanvas.current) {
      const ctx = smallCanvas.current.getContext("2d");
      const ratio = IMAGE_SIZE / CANVAS_SIZE;
      ctx.scale(ratio, ratio);
    }
  }, [smallCanvas]);

  useEffect(() => {
    if (predicting) {
      // Draw the main canvas to our smaller, correctly-sized canvas
      const ctx = smallCanvas.current.getContext("2d");
      ctx.drawImage(mainCanvas.current, 0, 0);

      getInference(smallCanvas.current, question).then((answer) => {
        setAnswer(answer);
        setPredicting(false);
      });
    }
  }, [predicting, question]);

  const onQuestionChange = useCallback(
    (e) => {
      setQuestion(e.target.value);
      setAnswer(null);
    },
    [setQuestion]
  );

  const randomizeImage = useCallback(() => {
    const context = mainCanvas.current.getContext("2d");
    const colorName = COLOR_NAMES[randint(0, COLOR_NAMES.length - 1)];
    const shape = SHAPES[randint(0, SHAPES.length - 1)];

    drawShape(context, shape, colorName);

    setColor(colorName);
    setShape(shape);
    setAnswer(null);
  }, [mainCanvas]);

  const randomizeQuestion = useCallback(() => {
    let q = question;
    while (q === question) {
      q = randomQuestion();
    }
    setQuestion(q);
    setAnswer(null);
  }, [question, setQuestion]);

  useEffect(() => {
    randomizeImage();

    loadModelPromise.then(() => {
      setModelLoaded(true);
    });
  }, []);

  return (
    <div className="root" id="container">
      {!isEmbedded && (
        <>
          <h1>Virtual Question Answering Results Demonstration</h1>
          <h2>
            APL405 Term Project{" "}
            {/* <a href="https://victorzhou.com/blog/easy-vqa/">
              Visual Question Answering (VQA)
            </a>{" "}
            model trained on the{" "}
            <a
              href="https://github.com/vzhou842/easy-VQA"
              target="_blank"
              rel="nofollow noreferrer"
            >
              easy-VQA dataset
            </a>
            . */}
          </h2>
          <p className="description">
            <b>
              {/* Read the{" "}
              <a href="https://victorzhou.com/blog/easy-vqa/">blog post</a>
            </b>{" "}
            or see the source code on{" "}
            <a
              href="https://github.com/vzhou842/easy-VQA-demo"
              target="_blank"
              rel="nofollow noreferrer"
            >
              Github
            </a>
            . */}
              Check the predictions for the questions corresponding to the
              images.
            </b>
          </p>
        </>
      )}
      <div className="container">
        <Row className="row1">
          <Col xs={12} md={6} lg={6} className=" d-flex justify-content-center">
            <Card className="cards align-middle">
              <Card.Header className="cardsHeader">The Question</Card.Header>
              <Card.Body className=" cardsBody">
                <Form className="cardForm">
                  <Form.Group controlId="formQuestion">
                    <Form.Control
                      className="cardForm"
                      as="textarea"
                      placeholder={SAMPLE_QUESTIONS[0]}
                      value={question}
                      onChange={onQuestionChange}
                      disabled={predicting}
                    />
                  </Form.Group>
                </Form>
                <Card.Text className="cardsText d-flex justify-content-center">
                  Want a different question?
                </Card.Text>
                <div className="d-flex justify-content-center">
                  <Button
                    onClick={randomizeQuestion}
                    disabled={predicting}
                    className="bt"
                  >
                    {" "}
                    <div className="btText d-flex justify-content-center">
                      Change Question
                    </div>
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
          <Col xs={12} md={6} lg={6} className=" d-flex justify-content-center">
            <Card className="cards">
              <Card.Header className="cardsHeader">
                <span className="ch">The Image</span>
              </Card.Header>

              <Card.Body className="cardsBody">
                <canvas
                  className="cardForm"
                  ref={mainCanvas}
                  width={CANVAS_SIZE}
                  height={CANVAS_SIZE}
                />
                <canvas
                  className="cardForm"
                  ref={smallCanvas}
                  width={IMAGE_SIZE}
                  height={IMAGE_SIZE}
                  style={{ display: "none" }}
                />
                <figcaption className="image-caption">
                  A <b>{color}</b>, <b>{shape}</b> shape.
                </figcaption>
                <br />
                <Card.Text className="cardsText d-flex justify-content-center">
                  Want a different image?
                </Card.Text>
                <div className="d-flex justify-content-center">
                  {" "}
                  <Button
                    onClick={randomizeImage}
                    disabled={predicting}
                    className="bt"
                  >
                    <div className="btText d-flex justify-content-center">
                      Change Image
                    </div>
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
      <Button
        className="bt1"
        variant="success"
        size="lg"
        onClick={onPredict}
        disabled={!modelLoaded || predicting}
      >
        {modelLoaded
          ? predicting
            ? "Predicting..."
            : "Predict"
          : "Loading model..."}
      </Button>
      <br />
      {!!answer ? (
        <Alert variant="primary">
          Prediction: <b>{answer}</b>
        </Alert>
      ) : predicting ? (
        <Alert variant="light">The prediction will appear here soon...</Alert>
      ) : (
        <Alert variant="light">Click Predict!</Alert>
      )}
    </div>
  );
}

export default App;
