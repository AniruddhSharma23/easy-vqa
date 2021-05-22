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
  var canvas = document.createElement("canvas");
  var width = (canvas.width = window.innerWidth * 0.75);
  var height = (canvas.height = window.innerHeight * 0.75);
  document.body.appendChild(canvas);
  var gl = canvas.getContext("webgl");

  var mouse = { x: 0, y: 0 };

  var numMetaballs = 30;
  var metaballs = [];

  for (var i = 0; i < numMetaballs; i++) {
    var radius = Math.random() * 60 + 10;
    metaballs.push({
      x: Math.random() * (width - 2 * radius) + radius,
      y: Math.random() * (height - 2 * radius) + radius,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 3,
      r: radius * 0.75,
    });
  }

  var vertexShaderSrc = `
attribute vec2 position;

void main() {
// position specifies only x and y.
// We set z to be 0.0, and w to be 1.0
gl_Position = vec4(position, 0.0, 1.0);
}
`;

  var fragmentShaderSrc =
    `
precision highp float;

const float WIDTH = ` +
    (width >> 0) +
    `.0;
const float HEIGHT = ` +
    (height >> 0) +
    `.0;

uniform vec3 metaballs[` +
    numMetaballs +
    `];

void main(){
float x = gl_FragCoord.x;
float y = gl_FragCoord.y;

float sum = 0.0;
for (int i = 0; i < ` +
    numMetaballs +
    `; i++) {
vec3 metaball = metaballs[i];
float dx = metaball.x - x;
float dy = metaball.y - y;
float radius = metaball.z;

sum += (radius * radius) / (dx * dx + dy * dy);
}

if (sum >= 0.99) {
gl_FragColor = vec4(mix(vec3(x / WIDTH, y / HEIGHT, 1.0), vec3(0, 0, 0), max(0.0, 1.0 - (sum - 0.99) * 100.0)), 1.0);
return;
}

gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}

`;

  var vertexShader = compileShader(vertexShaderSrc, gl.VERTEX_SHADER);
  var fragmentShader = compileShader(fragmentShaderSrc, gl.FRAGMENT_SHADER);

  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  gl.useProgram(program);

  var vertexData = new Float32Array([
    -1.0,
    1.0, // top left
    -1.0,
    -1.0, // bottom left
    1.0,
    1.0, // top right
    1.0,
    -1.0, // bottom right
  ]);
  var vertexDataBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexDataBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

  var positionHandle = getAttribLocation(program, "position");
  gl.enableVertexAttribArray(positionHandle);
  gl.vertexAttribPointer(
    positionHandle,
    2, // position is a vec2
    gl.FLOAT, // each component is a float
    gl.FALSE, // don't normalize values
    2 * 4, // two 4 byte float components per vertex
    0 // offset into each span of vertex data
  );

  var metaballsHandle = getUniformLocation(program, "metaballs");

  loop();
  function loop() {
    for (var i = 0; i < numMetaballs; i++) {
      var metaball = metaballs[i];
      metaball.x += metaball.vx;
      metaball.y += metaball.vy;

      if (metaball.x < metaball.r || metaball.x > width - metaball.r)
        metaball.vx *= -1;
      if (metaball.y < metaball.r || metaball.y > height - metaball.r)
        metaball.vy *= -1;
    }

    var dataToSendToGPU = new Float32Array(3 * numMetaballs);
    for (var i = 0; i < numMetaballs; i++) {
      var baseIndex = 3 * i;
      var mb = metaballs[i];
      dataToSendToGPU[baseIndex + 0] = mb.x;
      dataToSendToGPU[baseIndex + 1] = mb.y;
      dataToSendToGPU[baseIndex + 2] = mb.r;
    }
    gl.uniform3fv(metaballsHandle, dataToSendToGPU);

    //Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    requestAnimationFrame(loop);
  }

  function compileShader(shaderSource, shaderType) {
    var shader = gl.createShader(shaderType);
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw "Shader compile failed with: " + gl.getShaderInfoLog(shader);
    }

    return shader;
  }

  function getUniformLocation(program, name) {
    var uniformLocation = gl.getUniformLocation(program, name);
    if (uniformLocation === -1) {
      throw "Can not find uniform " + name + ".";
    }
    return uniformLocation;
  }

  function getAttribLocation(program, name) {
    var attributeLocation = gl.getAttribLocation(program, name);
    if (attributeLocation === -1) {
      throw "Can not find attribute " + name + ".";
    }
    return attributeLocation;
  }

  canvas.onmousemove = function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  };

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
          <h1>easy-VQA Demo</h1>
          <h2>
            A Javascript demo of a{" "}
            <a href="https://victorzhou.com/blog/easy-vqa/">
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
            .
          </h2>
          <p className="description">
            <b>
              Read the{" "}
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
            .
          </p>
        </>
      )}
      <div className="container">
        <Row className="row1">
          <Col xs={12} md={6} lg={6} className=" d-flex justify-content-center">
            <Card className="cards">
              <Card.Header className="cardsHeader">The Image</Card.Header>
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
                      Random Image
                    </div>
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
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
                      Random Question
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
