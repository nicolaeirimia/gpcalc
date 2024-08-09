const express = require('express');
const bodyParser = require("body-parser");
const app = express();
const ejs = require("ejs");
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const fsPromises = require('fs').promises;
const csvParser = require('csv-parser');

const storageCSV = multer.memoryStorage();

const uploadCSV = multer({ storage: multer.memoryStorage() });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './public/documents');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage
});


let Category;
let rawdata1 = fs.readFileSync('DB-products.json');
let rawdata2 = fs.readFileSync('Cocktails.json');
let rawdata3 = fs.readFileSync('Dishes.json');
let rawdata4 = fs.readFileSync('inventory.json');
let DB_products = JSON.parse(rawdata1);
let Cocktails = JSON.parse(rawdata2);
let Dishes = JSON.parse(rawdata3);
let Inventory = JSON.parse(rawdata4);

let reqGP1 = DB_products[0].requiredGP1;
let reqGP2 = DB_products[0].requiredGP2;
let reqGP3 = DB_products[0].requiredGP3;

app.set('view engine', 'ejs');

function calculateCocktailValues(ingredients, estSalePrice) {
  let sumTotal = 0;

  ingredients.forEach(ingredient => {
    sumTotal += ingredient.product.Unit * ingredient.quantity;
  });

  const totalCost = sumTotal;
  const costMargin = 100 - ((totalCost / estSalePrice) * 100);
  const netProfit = (estSalePrice - totalCost);

  return {
    totalCost: totalCost.toFixed(2),
    costMargin: costMargin.toFixed(2),
    netProfit: netProfit.toFixed(2)
  };
}

app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));

let LogedIn = false;

app.get('/', function (req, res) {

  if (!LogedIn) {
    res.render('home', {
      DB_products: DB_products
    })
  } else {
    res.render('login');
  }

});

app.post("/login", function (req, res) {

  let username = req.body.username;
  let password = req.body.password;

  if (username === "nicolae_irimia" && password === "nicolae") {
    LogedIn = true;
    res.redirect("/");
  } else {
    res.redirect("/");
  }

});

app.post("/logout", function (req, res) {
  LogedIn = false;
  res.redirect("/");
});

app.get("/settings", function (req, res) {
  res.render('settings', {
    DB_products: DB_products,
    Category: Category
  });
});

app.get("/cocktailcalculator", function (req, res) {
  res.render('cocktailcalculator', {
    DB_products: DB_products
  });
});
app.get("/dishescalculator", function (req, res) {
  res.render('dishescalculator', {
    DB_products: DB_products
  });
});

app.post("/updateGP", async function (req, res) {

  DB_products[0].requiredGP1 = req.body.requiredGP1;
  DB_products[0].requiredGP2 = req.body.requiredGP2;
  DB_products[0].requiredGP3 = req.body.requiredGP3;

  for (let i = 1; i < DB_products.length; i++) {

    let calcUnit = DB_products[i].Unit;
    DB_products[i].requiredGP1 = (calcUnit * 100 / (100 - DB_products[0].requiredGP1)).toFixed(2);
    DB_products[i].requiredGP2 = (calcUnit * 100 / (100 - DB_products[0].requiredGP2)).toFixed(2);
    DB_products[i].requiredGP3 = (calcUnit * 100 / (100 - DB_products[0].requiredGP3)).toFixed(2);

  }

  await fsPromises.writeFile("./DB-products.json", JSON.stringify(DB_products), function (err) {
    if (err) throw err;
    console.log('complete');
  });

  res.redirect("/");

});

app.post("/settings", async function (req, res) {

  const unit = req.body.net / req.body.yield;
  const noVAT = req.body.sales / 1.2;
  const currentGP = ((1 - unit / noVAT) * 100).toFixed(2) + "%";
  let recommended1 = (unit * 100 / (100 - reqGP1)).toFixed(2);
  let recommended2 = (unit * 100 / (100 - reqGP2)).toFixed(2);
  let recommended3 = (unit * 100 / (100 - reqGP3)).toFixed(2);

  let cashMargin = (noVAT-unit).toFixed(2) + "£";

  let newId;
  do {
    newId = Math.random().toString(36).substring(2, 8);
  } while (DB_products.some(item => item.id === newId));

  const post = {
    Category: req.body.category,
    Subcategory: req.body.subcategory,
    Type: req.body.type,
    Name: req.body.name,
    Unit: unit.toFixed(2),
    Size: req.body.size,
    Yield: req.body.yield,
    netPrice: req.body.net,
    salesVAT: req.body.sales,
    salesNoVAT: noVAT.toFixed(2),
    cashMargin: cashMargin,
    currentGP: currentGP,
    requiredGP1: recommended1,
    requiredGP2: recommended2,
    requiredGP3: recommended3,
    id: newId,
    openStock: 0,
    purchases: 0,
    credit: 0,
    transfersIn: 0,
    transfersOut: 0,
    closingStock: 0,
    TillRead: 0
  };

  let postExists = false;

  for (let i = 0; i < DB_products.length; i++) {
    if (DB_products[i].Category === post.Category && DB_products[i].Subcategory === post.Subcategory && DB_products[i].Name === post.Name) {

      DB_products[i] = post;
      postExists = true;
      break;
    }
  }

  if (!postExists) {
    DB_products.push(post);
  }


  Inventory.push({
    productID: newId,
    purchaseValues: {
      date: ["", "", "", "", "", "", "", ""],
      value: ["0", "0", "0", "0", "0", "0", "0", "0"],
      purchaseTotal: "0"
    },
    creditValues: {
      date: ["", "", "", "", "", "", "", ""],
      value: ["0", "0", "0", "0", "0", "0", "0", "0"],
      purchaseTotal: "0"
    },
    TransferIn: {
      date: ["", "", "", "", "", "", "", ""],
      value: ["0", "0", "0", "0", "0", "0", "0", "0"],
      purchaseTotal: "0"
    },
    TransferOut: {
      date: ["", "", "", "", "", "", "", ""],
      value: ["0", "0", "0", "0", "0", "0", "0", "0"],
      purchaseTotal: "0"
    }
  });

  await fsPromises.writeFile("./DB-products.json", JSON.stringify(DB_products), function (err) {
    if (err) throw err;
    console.log('complete');
  });

  await fsPromises.writeFile("./inventory.json", JSON.stringify(Inventory), function (err) {
    if (err) throw err;
    console.log('inventory.json complete');
  });

  res.redirect("/");

});

app.post('/deleteProduct', async (req, res) => {
  const objectIdToDelete = req.body.objectId;

  DB_products = DB_products.filter(item => item.id !== objectIdToDelete);
  Inventory = Inventory.filter(item => item.productID !== objectIdToDelete);

  await fsPromises.writeFile("./DB-products.json", JSON.stringify(DB_products), function (err) {
    if (err) throw err;
    console.log('complete');
  });
  await fsPromises.writeFile("./inventory.json", JSON.stringify(Inventory), function (err) {
    if (err) throw err;
    console.log('inventory.json complete');
  });

  res.redirect('/');
});

app.post('/updateProd', async (req, res) => {
  const id = req.body.Uid;
  const newName = req.body.Uname;
  const newYield = req.body.Uyield;
  const newNetPrice = req.body.UnetPrice;
  const newSalesVAT = req.body.UsalesVAT;


  DB_products.forEach(element => {
    if (id === element.id) {
      element.Name = newName;
      element.Yield = newYield;
      element.netPrice = newNetPrice;
      element.salesVAT = newSalesVAT;
      element.Unit = (newNetPrice / newYield).toFixed(2);
      element.salesNoVAT = (newSalesVAT / 1.2).toFixed(2);
      element.cashMargin = ((newSalesVAT / 1.2)-(newNetPrice / newYield)).toFixed(2) + "£";
      element.currentGP = ((1 - element.Unit / element.salesNoVAT) * 100).toFixed(2) + "%";
      element.requiredGP1 = (element.Unit * 100 / (100 - reqGP1)).toFixed(2);
      element.requiredGP2 = (element.Unit * 100 / (100 - reqGP2)).toFixed(2);
      element.requiredGP3 = (element.Unit * 100 / (100 - reqGP3)).toFixed(2);
    }
  });

  Cocktails.forEach(cocktail => {
    cocktail.ingredients.forEach(ingredient => {
      if (ingredient.product.id === id) {
        ingredient.product.Name = newName;
        ingredient.product.Yield = newYield;
        ingredient.product.netPrice = newNetPrice;
        ingredient.product.salesVAT = newSalesVAT;
        ingredient.product.Unit = (newNetPrice / newYield).toFixed(2);
        ingredient.product.salesNoVAT = (newSalesVAT / 1.2).toFixed(2);
        ingredient.product.currentGP = ((1 - ingredient.product.Unit / ingredient.product.salesNoVAT) * 100).toFixed(2) + "%";
        ingredient.product.requiredGP1 = (ingredient.product.Unit * 100 / (100 - reqGP1)).toFixed(2);
        ingredient.product.requiredGP2 = (ingredient.product.Unit * 100 / (100 - reqGP2)).toFixed(2);
        ingredient.product.requiredGP3 = (ingredient.product.Unit * 100 / (100 - reqGP3)).toFixed(2);

        let sumTotal = 0;
        cocktail.ingredients.forEach(ingredient => {
          sumTotal += ingredient.product.Unit * ingredient.quantity;
        });
        cocktail.totalCost = sumTotal.toFixed(2);

        cocktail.costMargin = (100 - ((cocktail.totalCost / cocktail.estimatedSalesPrice) * 100)).toFixed(2);
        cocktail.netProfit = (cocktail.estimatedSalesPrice - cocktail.totalCost).toFixed(2);
      }
    });
  });
  Dishes.forEach(dish => {
    dish.ingredients.forEach(ingredient => {
      if (ingredient.product.id === id) {
        ingredient.product.Name = newName;
        ingredient.product.Yield = newYield;
        ingredient.product.netPrice = newNetPrice;
        ingredient.product.salesVAT = newSalesVAT;
        ingredient.product.Unit = (newNetPrice / newYield).toFixed(2);
        ingredient.product.salesNoVAT = (newSalesVAT / 1.2).toFixed(2);
        ingredient.product.currentGP = ((1 - ingredient.product.Unit / ingredient.product.salesNoVAT) * 100).toFixed(2) + "%";
        ingredient.product.requiredGP1 = (ingredient.product.Unit * 100 / (100 - reqGP1)).toFixed(2);
        ingredient.product.requiredGP2 = (ingredient.product.Unit * 100 / (100 - reqGP2)).toFixed(2);
        ingredient.product.requiredGP3 = (ingredient.product.Unit * 100 / (100 - reqGP3)).toFixed(2);

        let sumTotal = 0;
        dish.ingredients.forEach(ingredient => {
          sumTotal += ingredient.product.Unit * ingredient.quantity;
        });
        dish.totalCost = sumTotal.toFixed(2);

        dish.costMargin = (100 - ((dish.totalCost / dish.estimatedSalesPrice) * 100)).toFixed(2);
        dish.netProfit = (dish.estimatedSalesPrice - dish.totalCost).toFixed(2);
      }
    });
  });


  await fsPromises.writeFile("./DB-products.json", JSON.stringify(DB_products), function (err) {
    if (err) throw err;
    console.log('complete');
  });

  await fsPromises.writeFile("./Cocktails.json", JSON.stringify(Cocktails), function (err) {
    if (err) throw err;
    console.log('Cocktails file updated');
  });
  await fsPromises.writeFile("./Dishes.json", JSON.stringify(Dishes), function (err) {
    if (err) throw err;
    console.log('Dishes file updated');
  });

  res.redirect('/');
});

app.post('/submitCocktail', upload.single('photo'), async (req, res) => {

  let newId;
  do {
    newId = Math.random().toString(36).substring(2, 8);
  } while (Cocktails.some(item => item.id === newId));


  let sumTotal = 0;
  let ingredients = [];

  for (let i = 0; i < 8; i++) {
    const selectedProductKey = `selectedProduct_${i}`;
    const qtyKey = `qty_${i}`;

    if (req.body[selectedProductKey] !== "") {

      const matchingProduct = DB_products.find(product => product.id === req.body[selectedProductKey]);

      if (matchingProduct) {

        const partSum = matchingProduct.Unit * req.body[qtyKey];
        sumTotal += partSum;

        ingredients.push({
          product: matchingProduct,
          quantity: req.body[qtyKey]
        });
      }
    }
  }

  const totalCost = sumTotal;
  const estSalePrice = parseFloat(req.body.estSalePrice);
  const costMargin = 100 - ((totalCost / estSalePrice) * 100);
  const netProfit = estSalePrice - totalCost;

  const cocktail = {
    Date: req.body.date,
    Name: req.body.name,
    estimatedSalesPrice: estSalePrice,
    totalCost: totalCost.toFixed(2),
    costMargin: costMargin.toFixed(2),
    netProfit: netProfit.toFixed(2),
    details: req.body.details,
    photoName: req.file.filename,
    ingredients: ingredients,
    id: newId
  };

  let cocktailExists = false;

  for (let i = 0; i < Cocktails.length; i++) {
    if (Cocktails[i].Name === cocktail.Name) {

      Cocktails[i] = cocktail;
      cocktailExistsExists = true;
      break;
    }
  }

  if (!cocktailExists) {
    Cocktails.push(cocktail);
  }

  await fsPromises.writeFile("./Cocktails.json", JSON.stringify(Cocktails), function (err) {
    if (err) throw err;
    console.log('complete');
  });

  res.redirect('/cocktails');
});

app.get("/cocktails", function (req, res) {
  res.render('cocktails', {
    Cocktails: Cocktails,
    DB_products: DB_products
  });
});


app.post('/submitDish', upload.single('photo'), async (req, res) => {

  let newId;
  do {
    newId = Math.random().toString(36).substring(2, 8);
  } while (Dishes.some(item => item.id === newId));


  let sumTotal = 0;
  let ingredients = [];

  for (let i = 0; i < 8; i++) {
    const selectedProductKey = `selectedProduct_${i}`;
    const qtyKey = `qty_${i}`;

    if (req.body[selectedProductKey] !== "") {

      const matchingProduct = DB_products.find(product => product.id === req.body[selectedProductKey]);

      if (matchingProduct) {

        const partSum = matchingProduct.Unit * req.body[qtyKey];
        sumTotal += partSum;

        ingredients.push({
          product: matchingProduct,
          quantity: req.body[qtyKey]
        });
      }
    }
  }

  const totalCost = sumTotal;
  const estSalePrice = parseFloat(req.body.estSalePrice);
  const costMargin = 100 - ((totalCost / estSalePrice) * 100);
  const netProfit = estSalePrice - totalCost;

  const dish = {
    Date: req.body.date,
    Name: req.body.name,
    estimatedSalesPrice: estSalePrice,
    totalCost: totalCost.toFixed(2),
    costMargin: costMargin.toFixed(2),
    netProfit: netProfit.toFixed(2),
    details: req.body.details,
    photoName: req.file.filename,
    ingredients: ingredients,
    id: newId
  };

  let dishExists = false;

  for (let i = 0; i < Dishes.length; i++) {
    if (Dishes[i].Name === dish.Name) {

      Dishes[i] = dish;
      dishExists = true;
      break;
    }
  }

  if (!dishExists) {
    Dishes.push(dish);
  }

  await fsPromises.writeFile("./Dishes.json", JSON.stringify(Dishes), function (err) {
    if (err) throw err;
    console.log('complete');
  });

  res.redirect('/dishes');
});

app.get("/dishes", function (req, res) {
  res.render('dishes', {
    Dishes: Dishes,
    DB_products: DB_products
  });
});

app.post('/addIngredientDish', async (req, res) => {
  const selectedProduct = req.body.newIngredientProduct;
  const newIngredientQuantity = parseFloat(req.body.newIngredientQuantity);
  const targetDishId = req.body.targetDishId;

  const selectedProductData = DB_products.find(product => product.id === selectedProduct);

  if (selectedProductData) {
    const targetDish = Dishes.find(dish => dish.id === targetDishId);

    if (targetDish) {

      const existingIngredient = targetDish.ingredients.find(ingredient => ingredient.product.id === selectedProduct);

      if (existingIngredient) {

        existingIngredient.quantity = Number(existingIngredient.quantity) + Number(newIngredientQuantity);
      } else {

        const newIngredient = {
          "product": selectedProductData,
          "quantity": newIngredientQuantity
        };

        targetDish.ingredients.push(newIngredient);
      }

      const updatedDishValues = calculateCocktailValues(targetDish.ingredients, targetDish.estimatedSalesPrice);
      targetDish.totalCost = updatedDishValues.totalCost;
      targetDish.costMargin = updatedDishValues.costMargin;
      targetDish.netProfit = updatedDishValues.netProfit;
    }
  }

  await fsPromises.writeFile("./Dishes.json", JSON.stringify(Dishes), function (err) {
    if (err) throw err;
    console.log('File updated successfully');
  });

  res.redirect('/dishes');
});
app.post('/addIngredientCocktail', async (req, res) => {
  const selectedProduct = req.body.newIngredientProduct;
  const newIngredientQuantity = parseFloat(req.body.newIngredientQuantity);
  const targetCocktailId = req.body.targetCocktailId;

  const selectedProductData = DB_products.find(product => product.id === selectedProduct);

  if (selectedProductData) {
    const targetCocktail = Cocktails.find(cocktail => cocktail.id === targetCocktailId);

    if (targetCocktail) {

      const existingIngredient = targetCocktail.ingredients.find(ingredient => ingredient.product.id === selectedProduct);

      if (existingIngredient) {

        existingIngredient.quantity = Number(existingIngredient.quantity) + Number(newIngredientQuantity);
      } else {

        const newIngredient = {
          "product": selectedProductData,
          "quantity": newIngredientQuantity
        };

        targetCocktail.ingredients.push(newIngredient);
      }

      const updatedCocktailValues = calculateCocktailValues(targetCocktail.ingredients, targetCocktail.estimatedSalesPrice);
      targetCocktail.totalCost = updatedCocktailValues.totalCost;
      targetCocktail.costMargin = updatedCocktailValues.costMargin;
      targetCocktail.netProfit = updatedCocktailValues.netProfit;
    }
  }

  await fsPromises.writeFile("./Cocktails.json", JSON.stringify(Cocktails), function (err) {
    if (err) throw err;
    console.log('File updated successfully');
  });

  res.redirect('/cocktails');
});

app.post('/updateCocktail', async (req, res) => {
  try {
    const cocktailId = req.body.cocktailId;
    const cocktailIndex = Cocktails.findIndex(cocktail => cocktail.id === cocktailId);

    if (req.body.buttonClicked && cocktailIndex !== -1) {
      const ingredientIdToDelete = req.body.buttonClicked;
      const ingredientIndex = Cocktails[cocktailIndex].ingredients.findIndex(ingredient => ingredient.product.id === ingredientIdToDelete);

      if (ingredientIndex !== -1) {
        Cocktails[cocktailIndex].ingredients.splice(ingredientIndex, 1);

        // Update the file content
        await fsPromises.writeFile("./Cocktails.json", JSON.stringify(Cocktails), {
          encoding: 'utf-8'
        });

        console.log('Cocktail updated successfully');
      }
    }

    const cocktail = Cocktails[cocktailIndex];
    cocktail.Name = req.body.name;
    cocktail.estimatedSalesPrice = parseFloat(req.body.estimatedSalesPrice);
    cocktail.details = req.body.details;

    cocktail.ingredients.forEach(ingredient => {
      const productName = ingredient.product.Name;
      const updatedQuantity = parseFloat(req.body[productName + '_quantity']);
      if (!isNaN(updatedQuantity)) {
        ingredient.quantity = updatedQuantity;
      }
    });

    const {
      totalCost,
      costMargin,
      netProfit
    } = calculateCocktailValues(cocktail.ingredients, cocktail.estimatedSalesPrice);
    cocktail.totalCost = totalCost;
    cocktail.costMargin = costMargin;
    cocktail.netProfit = netProfit;

    await fsPromises.writeFile("./Cocktails.json", JSON.stringify(Cocktails), {
      encoding: 'utf-8'
    });

    console.log('Cocktail updated successfully');

    res.redirect('/cocktails');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});
app.post('/deleteCocktail', async (req, res) => {
  const cocktailIdToDelete = req.body.cocktailId;

  const indexToDelete = Cocktails.findIndex(cocktail => cocktail.id === cocktailIdToDelete);

  if (indexToDelete !== -1) {

      Cocktails.splice(indexToDelete, 1);

      await fsPromises.writeFile("./Cocktails.json", JSON.stringify(Cocktails), function (err) {
        if (err) throw err;
        console.log('cocktails.json complete');
      });

      res.redirect('/cocktails');
  }

});

app.post('/updateDish', async (req, res) => {
  try {
    const DishId = req.body.DishId;
    const DishIndex = Dishes.findIndex(Dish => Dish.id === DishId);

    if (req.body.buttonClicked && DishIndex !== -1) {
      const ingredientIdToDelete = req.body.buttonClicked;
      const ingredientIndex = Dishes[DishIndex].ingredients.findIndex(ingredient => ingredient.product.id === ingredientIdToDelete);

      if (ingredientIndex !== -1) {
        Dishes[DishIndex].ingredients.splice(ingredientIndex, 1);

        await fsPromises.writeFile("./Dishes.json", JSON.stringify(Dishes), {
          encoding: 'utf-8'
        });

        console.log('Dish updated successfully');
      }
    }

    const Dish = Dishes[DishIndex];
    Dish.Name = req.body.name;
    Dish.estimatedSalesPrice = parseFloat(req.body.estimatedSalesPrice);
    Dish.details = req.body.details;

    Dish.ingredients.forEach(ingredient => {
      const productName = ingredient.product.Name;
      const updatedQuantity = parseFloat(req.body[productName + '_quantity']);
      if (!isNaN(updatedQuantity)) {
        ingredient.quantity = updatedQuantity;
      }
    });

    const {
      totalCost,
      costMargin,
      netProfit
    } = calculateCocktailValues(Dish.ingredients, Dish.estimatedSalesPrice);
    Dish.totalCost = totalCost;
    Dish.costMargin = costMargin;
    Dish.netProfit = netProfit;

    await fsPromises.writeFile("./Dishes.json", JSON.stringify(Dishes), {
      encoding: 'utf-8'
    });

    console.log('Dish updated successfully');

    res.redirect('/dishes');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/deleteDish', async (req, res) => {
  const DishIDtoDelete = req.body.dishId;

  const indexToDelete = Dishes.findIndex(cocktail => cocktail.id === DishIDtoDelete);

  if (indexToDelete !== -1) {

      Dishes.splice(indexToDelete, 1);

      await fsPromises.writeFile("./Dishes.json", JSON.stringify(Dishes), function (err) {
        if (err) throw err;
        console.log('dishes.json complete');
      });

      res.redirect('/dishes');
  }

});


app.get("/inventory", function (req, res) {
  res.render('inventory', {
    DB_products: DB_products
  });
});

app.post('/updateOpenStock', async (req, res) => {
  const productID = (req.body.productID);
  const newOpenStock = (req.body.openStock);


  const productIndex = DB_products.findIndex(product => product.id === productID);

  if (productIndex !== -1) {

    DB_products[productIndex].openStock = parseFloat(newOpenStock);
  } else {

    DB_products.push({
      id: productID,
      openStock: parseFloat(newOpenStock)
    });
  }


  await fsPromises.writeFile("./DB-products.json", JSON.stringify(DB_products), function (err) {
    if (err) throw err;
    console.log('complete');
  });

  res.redirect('/inventory');
});

app.get('/purchases', (req, res) => {
  res.render('purchases', {
    DB_products: DB_products,
    Inventory: Inventory
  });
});

app.post('/updatePurchase', async (req, res) => {
  const productIDs = req.body.productID;
  let dates = req.body.date;
  let values = req.body.value;


  for (i = 0; i < productIDs.length; i++) {

    const productID = productIDs[i];
    const purchaseTotal = req.body[`purchaseTotal${productID}`];

    const productIndex = DB_products.findIndex(product => product.id === productID);
    DB_products[productIndex].purchases = parseFloat(purchaseTotal);


    const existingPurchaseIndex = Inventory.findIndex(purchase => purchase.productID === productID);

    if (existingPurchaseIndex !== -1) {
      Inventory[existingPurchaseIndex].purchaseValues.date = dates[productID];
      Inventory[existingPurchaseIndex].purchaseValues.value = values[productID];
      Inventory[existingPurchaseIndex].purchaseValues.purchaseTotal = purchaseTotal;
    } else {
      Inventory.push({
        productID: productID,
        purchaseValues: {
          date: dates[productID],
          value: values[productID],
          purchaseTotal: purchaseTotal
        }

      });
    }
  }


  await fsPromises.writeFile("./DB-products.json", JSON.stringify(DB_products), function (err) {
    if (err) throw err;
    console.log('DB-products.json complete');
  });

  await fsPromises.writeFile("./inventory.json", JSON.stringify(Inventory), function (err) {
    if (err) throw err;
    console.log('inventory.json complete');
  });

  res.redirect('/inventory');
});

app.get('/credit', (req, res) => {
  res.render('credit', {
    DB_products: DB_products,
    Inventory: Inventory
  });
});

app.post('/updateCredit', async (req, res) => {
  const productIDs = req.body.productID;
  let dates = req.body.date;
  let values = req.body.value;

  for (let i = 0; i < productIDs.length; i++) {
    const productID = productIDs[i];
    const creditTotal = req.body[`creditTotal${productID}`];

    const productIndex = DB_products.findIndex(product => product.id === productID);
    DB_products[productIndex].credit = parseFloat(creditTotal);

    const existingCreditIndex = Inventory.findIndex(credit => credit.productID === productID);

    if (existingCreditIndex !== -1) {
      Inventory[existingCreditIndex].creditValues.date = dates[productID];
      Inventory[existingCreditIndex].creditValues.value = values[productID];
      Inventory[existingCreditIndex].creditValues.creditTotal = creditTotal;
    } else {
      Inventory.push({
        productID: productID,
        creditValues: {
          date: dates[productID],
          value: values[productID],
          creditTotal: creditTotal
        }
      });
    }
  }

  await fsPromises.writeFile("./DB-products.json", JSON.stringify(DB_products), function (err) {
    if (err) throw err;
    console.log('DB-products.json complete');
  });

  await fsPromises.writeFile("./inventory.json", JSON.stringify(Inventory), function (err) {
    if (err) throw err;
    console.log('inventory.json complete');
  });

  res.redirect('/inventory');
});

app.get('/transfersin', (req, res) => {
  res.render('transfersin', {
    DB_products: DB_products,
    Inventory: Inventory
  });
});

app.post('/updateTransfersIn', async (req, res) => {
  const productIDs = req.body.productID;
  let dates = req.body.date;
  let values = req.body.value;

  for (let i = 0; i < productIDs.length; i++) {
    const productID = productIDs[i];
    const transfersInTotal = req.body[`transfersInTotal${productID}`];

    const productIndex = DB_products.findIndex(product => product.id === productID);
    DB_products[productIndex].transfersIn = parseFloat(transfersInTotal);

    const existingTransfersInIndex = Inventory.findIndex(transfersIn => transfersIn.productID === productID);

    if (existingTransfersInIndex !== -1) {
      Inventory[existingTransfersInIndex].TransferIn.date = dates[productID];
      Inventory[existingTransfersInIndex].TransferIn.value = values[productID];
      Inventory[existingTransfersInIndex].TransferIn.transfersInTotal = transfersInTotal;
    } else {
      Inventory.push({
        productID: productID,
        TransferIn: {
          date: dates[productID],
          value: values[productID],
          transfersInTotal: transfersInTotal
        }
      });
    }
  }

  await fsPromises.writeFile("./DB-products.json", JSON.stringify(DB_products), function (err) {
    if (err) throw err;
    console.log('DB-products.json complete');
  });

  await fsPromises.writeFile("./inventory.json", JSON.stringify(Inventory), function (err) {
    if (err) throw err;
    console.log('inventory.json complete');
  });

  res.redirect('/inventory');
});

app.get('/transfersout', (req, res) => {
  res.render('transfersout', {
    DB_products: DB_products,
    Inventory: Inventory
  });
});

app.post('/updateTransfersOut', async (req, res) => {
  const productIDs = req.body.productID;
  let dates = req.body.date;
  let values = req.body.value;

  for (let i = 0; i < productIDs.length; i++) {
    const productID = productIDs[i];
    const transfersOutTotal = req.body[`transfersOutTotal${productID}`];

    const productIndex = DB_products.findIndex(product => product.id === productID);
    DB_products[productIndex].transfersOut = parseFloat(transfersOutTotal);

    const existingTransfersOutIndex = Inventory.findIndex(transfersOut => transfersOut.productID === productID);

    if (existingTransfersOutIndex !== -1) {
      Inventory[existingTransfersOutIndex].TransferOut.date = dates[productID];
      Inventory[existingTransfersOutIndex].TransferOut.value = values[productID];
      Inventory[existingTransfersOutIndex].TransferOut.transfersOutTotal = transfersOutTotal;
    } else {
      Inventory.push({
        productID: productID,
        TransferOut: {
          date: dates[productID],
          value: values[productID],
          transfersOutTotal: transfersOutTotal
        }
      });
    }
  }

  await fsPromises.writeFile("./DB-products.json", JSON.stringify(DB_products), function (err) {
    if (err) throw err;
    console.log('DB-products.json complete');
  });

  await fsPromises.writeFile("./inventory.json", JSON.stringify(Inventory), function (err) {
    if (err) throw err;
    console.log('inventory.json complete');
  });

  res.redirect('/inventory');
});

app.post('/updateClosingData', async (req, res) => {
  const productID = (req.body.productID);
  const newClosingStock = (req.body.closeStock);


  const productIndex = DB_products.findIndex(product => product.id === productID);

  if (productIndex !== -1) {

    DB_products[productIndex].closingStock = parseFloat(newClosingStock);
  } else {

    DB_products.push({
      id: productID,
      closingStock: parseFloat(newClosingStock)
    });
  }


  await fsPromises.writeFile("./DB-products.json", JSON.stringify(DB_products), function (err) {
    if (err) throw err;
    console.log('complete');
  });

  res.redirect('/inventory');
});

app.post('/updateTillRead', async (req, res) => {
  const productID = (req.body.productID);
  const newTillRead = (req.body.TillRead);


  const productIndex = DB_products.findIndex(product => product.id === productID);

  if (productIndex !== -1) {

    DB_products[productIndex].TillRead = parseFloat(newTillRead);
  } else {

    DB_products.push({
      id: productID,
      TillRead: parseFloat(newTillRead)
    });
  }


  await fsPromises.writeFile("./DB-products.json", JSON.stringify(DB_products), function (err) {
    if (err) throw err;
    console.log('complete');
  });

  res.redirect('/inventory');
});

app.post('/uploadCSV', uploadCSV.single('csvFile'), async (req, res) => {

  if (!req.file || !req.file.buffer) {
    return res.status(400).send('No file uploaded.');
  }

  const csvData = req.file.buffer.toString();

  const rows = [];
  const csvParserInstance = csvParser({ separator: ',' });

  csvParserInstance
    .on('data', (row) => {

      const filteredRow = Object.keys(row)
      .slice(0, 8)
      .reduce((result, key) => {
        result[key] = row[key];
        return result;
      }, {});

    rows.push(filteredRow);
    })
    .on('end', async () => {


      rows.forEach((row) => {

            // Normalize keys (remove quotes)
      const normalizedRow = {};
      for (const key in row) {
      const normalizedKey = key.trim().replace(/^['"]+|['"]+$/g, '');
      normalizedRow[normalizedKey] = row[key];
    }
        const unit = row.netPrice / row.Yield;
        const noVAT = row.salesVAT / 1.2;
        const currentGP = ((1 - unit / noVAT) * 100).toFixed(2) + "%";
        let recommended1 = (unit * 100 / (100 - reqGP1)).toFixed(2);
        let recommended2 = (unit * 100 / (100 - reqGP2)).toFixed(2);
        let recommended3 = (unit * 100 / (100 - reqGP3)).toFixed(2);
        let cashMargin = (noVAT-unit).toFixed(2) + "£";
      
        let newId;
        do {
          newId = Math.random().toString(36).substring(2, 8);
        } while (DB_products.some(item => item.id === newId));
      
              const product = {
                Category: normalizedRow.Category,
                Subcategory: row.Subcategory,
                Type: row.Type,
                Name: row.Name,
                Unit: unit.toFixed(2),
                Size: row.Size,
                Yield: row.Yield,
                netPrice: row.netPrice,
                salesVAT: row.salesVAT,
                salesNoVAT: noVAT.toFixed(2),
                cashMargin: cashMargin,
                currentGP: currentGP,
                requiredGP1: recommended1,
                requiredGP2: recommended2,
                requiredGP3: recommended3,
                id: newId,
                openStock: 0,
                purchases: 0,
                credit: 0,
                transfersIn: 0,
                transfersOut: 0,
                closingStock: 0,
                TillRead: 0
              }
              
        DB_products.push(product);
      });

      try {
        await fsPromises.writeFile("./DB-products.json", JSON.stringify(DB_products));
        console.log('complete');
        res.redirect('/');
      } catch (err) {
        console.error(err);
        res.status(500).send('An error occurred while writing the file.');
      }
    });

  const readableStream = require('stream').Readable.from([csvData]);
  readableStream.pipe(csvParserInstance);
});


app.get('*', function (req, res) {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(process.env.PORT || 3000, function () {
  console.log("Server started on port 3000 or process.env.PORT");
});