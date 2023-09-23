const mongoose = require('mongoose');
const ObjectId = require('mongodb').ObjectId;
const Modeldata = require('../models').data;

exports.getAllYears = async (req, res) => {
  const collections = await mongoose.connection.db.listCollections().toArray();

  const yearCollections = collections.filter((collection) => {
    const collectionName = collection.name;
    const year = parseInt(collectionName);
    return !isNaN(year);
  });

  const years = yearCollections.map((collection) => collection.name);

  res.status(200).send({ years: years });
};

exports.getModelDataByYear = async (req, res) => {
  const year = req.params.year;

  try {
    const data = await mongoose.connection.db.collection(year).find({}).toArray();
    res.status(200).send({ year: year, data: data });
  } catch (err) {
    console.error(`Error fetching model data for year ${year}:`, err);
    res.status(500).send({ message: `Error fetching model data for year ${year}` });
  }
};

exports.editEquipment = async (req, res) => {
  try {
    const editedEquipment = req.body.equipment;

    // Assuming the year is stored in the equipment data
    const year = req.body.year;

    // Get the appropriate collection based on the year
    const collectionName = year.toString(); // Convert year to a string
    const collection = mongoose.connection.db.collection(collectionName);
    const newEquipment = { ...editedEquipment };
    delete newEquipment._id;
    const updatedEquipment = await collection.findOneAndUpdate(
      { _id: new ObjectId(editedEquipment._id) }, // Use an appropriate identifier for your equipment
      { $set: newEquipment }, // Use $set to specify the fields to update
      { new: true } // Return the updated document
    );

    if (!updatedEquipment) {
      // If the equipment was not found, return a 404 status
      return res.status(404).json({ message: 'Equipment not found' });
    }

    // Send a success response with the updated equipment
    res.status(200).json(updatedEquipment);
  } catch (error) {
    console.error('Error editing equipment:', error);
    // Send an error response
    res.status(500).json({ message: 'Error editing equipment' });
  }
};

exports.generateNextYearEquipData = async (req, res) => {
  try {
    const { priceIncreaseRate } = req.body;
    const year = new Date().getFullYear();
    // Get the equipment data for the current year (assuming it's stored in a collection named after the year)
    const currentYearCollectionName = year.toString();
    const currentYearCollection = mongoose.connection.db.collection(currentYearCollectionName);
    const currentYearEquipmentData = await currentYearCollection.find({}).toArray();

    if (!currentYearEquipmentData || currentYearEquipmentData.length === 0) {
      return res.status(404).json({ message: `No equipment data found for year ${year}` });
    }
    const nextYear = (parseInt(year) + 1).toString();
    const nextYearCollectionForCheck = mongoose.connection.db.collection(nextYear);
    const existingData = await nextYearCollectionForCheck.find({}).toArray();

    if (existingData.length > 0) {
      return res.status(409).json({ message: `Equipment data for year ${nextYear} already exists` });
    }
    const nextYearEquipmentData = currentYearEquipmentData.map((equipment) => {
      const nextYrEquipment = { ...equipment };
      nextYrEquipment.Original_price = Math.round(equipment.Original_price * (1 + priceIncreaseRate / 100));
      nextYrEquipment.Current_Market_Year_Resale_Value = Math.round(Math.max(
        equipment.Original_price - ((nextYear - year) * equipment.Original_price * (1 - equipment.Salvage_Value)) / (equipment.Economic_Life_in_months / 12),
        equipment.Original_price * equipment.Salvage_Value
      ));
      nextYrEquipment.Depreciation_Ownership_cost_Monthly = (equipment.Original_price * (1 + equipment.Sales_Tax) * (1 - equipment.Discount) * (1 - equipment.Salvage_Value) + (equipment.Initial_Freight_cost * equipment.Original_price)) / (equipment.Economic_Life_in_months / equipment.Usage_rate);
      nextYrEquipment.Cost_of_Facilities_Capital_Ownership_cost_Monthly = equipment.Cost_of_Capital_rate * equipment.Original_price / 12 / equipment.Usage_rate;
      nextYrEquipment.Overhead_Ownership_cost_Monthly = equipment.Annual_Overhead_rate * equipment.Current_Market_Year_Resale_Value / 12 / equipment.Usage_rate;
      nextYrEquipment.Overhaul_Labor_Ownership_cost_Monthly = equipment.Hourly_Wage * equipment.Annual_Overhaul_Labor_Hours / 12 / equipment.Usage_rate;
      nextYrEquipment.Overhaul_Parts_Ownership_cost_Monthly = equipment.Annual_Overhaul_Parts_cost_rate * equipment.Original_price / 12 / equipment.Usage_rate;
      nextYrEquipment.Total_ownership_cost_hourly = (equipment.Depreciation_Ownership_cost_Monthly + equipment.Cost_of_Facilities_Capital_Ownership_cost_Monthly + equipment.Overhead_Ownership_cost_Monthly + equipment.Overhaul_Labor_Ownership_cost_Monthly + equipment.Overhaul_Parts_Ownership_cost_Monthly) / 176;
      nextYrEquipment.Field_Labor_Operating_cost_Hourly = equipment.Annual_Field_Labor_Hours * equipment.Hourly_Wage / 12 / equipment.Monthly_use_hours;
      nextYrEquipment.Field_Parts_Operating_cost_Hourly = equipment.Annual_Field_Repair_Parts_and_misc_supply_parts_Cost_rate * equipment.Original_price / 12 / equipment.Monthly_use_hours;
      nextYrEquipment.Ground_Engaging_Component_Cost_Operating_cost_Hourly = equipment.Annual_Ground_Engaging_Component_rate * equipment.Original_price / 12 / equipment.Monthly_use_hours;
      nextYrEquipment.Fuel_by_horse_power_Operating_cost_Hourly = (equipment['Reimbursable Fuel_type (1 diesel, 2 gas, 3 other)'] === 1 ? 0.04 : equipment['Reimbursable Fuel_type (1 diesel, 2 gas, 3 other)'] === 2 ? 0.06 : 0) * equipment.Horse_power * equipment.Fuel_unit_price;
      nextYrEquipment.Tire_Costs_Operating_cost_Hourly = equipment.Cost_of_A_New_Set_of_Tires / equipment.Tire_Life_Hours;
      nextYrEquipment.Total_operating_cost = equipment.Field_Labor_Operating_cost_Hourly + equipment.Field_Parts_Operating_cost_Hourly + equipment.Ground_Engaging_Component_Cost_Operating_cost_Hourly + equipment.Lube_Operating_cost_Hourly + equipment.Fuel_by_horse_power_Operating_cost_Hourly + equipment.Tire_Costs_Operating_cost_Hourly;
      nextYrEquipment.Total_cost_recovery = equipment.Total_ownership_cost_hourly + equipment.Total_operating_cost;
      return nextYrEquipment;
    });

    // Insert the newly generated equipment data into the collection for the next year
    const nextYearCollectionName = nextYear;
    const nextYearCollection = mongoose.connection.db.collection(nextYearCollectionName);
    await nextYearCollection.insertMany(nextYearEquipmentData);

    res.status(200).json({ message: `Equipment data for year ${nextYear} generated successfully` });
  } catch (error) {
    console.error('Error generating next year equipment data:', error);
    res.status(500).json({ message: 'Error generating next year equipment data' });
  }
};

exports.getFuelCosts = async (req, res) => {
  try {
    const fuelCostsCollection = mongoose.connection.db.collection('fuelcosts');
    const fuelCosts = await fuelCostsCollection.findOne({});

    if (!fuelCosts) {
      return res.status(404).json({ message: 'Fuel costs not found' });
    }

    res.status(200).json({ fuelCosts });
  } catch (error) {
    console.error('Error fetching fuel costs:', error);
    res.status(500).json({ message: 'Error fetching fuel costs' });
  }
};

const updateFuelCostsForYear = async (year, fuelCosts) => {
  const equipmentCollection = mongoose.connection.db.collection(year);

  const equipmentData = await equipmentCollection.find({}).toArray();

  const updatedEquipmentData = equipmentData.map((equipment) => {
    let fuelUnitPrice;
    if (equipment['Reimbursable Fuel_type (1 diesel, 2 gas, 3 other)'] === 1) {
      fuelUnitPrice = fuelCosts.diesel_price;
    } else if (equipment['Reimbursable Fuel_type (1 diesel, 2 gas, 3 other)'] === 2) {
      fuelUnitPrice = fuelCosts.gasoline_price;
    } else {
      fuelUnitPrice = fuelCosts.other;
    }

    equipment.Fuel_unit_price = fuelUnitPrice;
    equipment.Fuel_by_horse_power_Operating_cost_Hourly =
      (equipment['Reimbursable Fuel_type (1 diesel, 2 gas, 3 other)'] === 1 ? 0.04 :
       equipment['Reimbursable Fuel_type (1 diesel, 2 gas, 3 other)'] === 2 ? 0.06 : 0) *
      equipment.Horse_power * fuelUnitPrice;

    return equipment;
  });

  const updatePromises = updatedEquipmentData.map((equipment) =>
    equipmentCollection.updateOne({ _id: equipment._id }, { $set: equipment })
  );

  await Promise.all(updatePromises);
};

exports.editFuelCosts = async (req, res) => {
  try {
    const fuelCosts = req.body;

    const fuelCostsCollection = mongoose.connection.db.collection('fuelcosts');
    await fuelCostsCollection.updateOne({}, { $set: fuelCosts }, { upsert: true });

    const equipmentCollections = await mongoose.connection.db.listCollections().toArray();
    const yearCollections = equipmentCollections
      .filter((collection) => !isNaN(parseInt(collection.name)))
      .map((collection) => collection.name)
      .sort();

    const updatePromises = yearCollections.map((year) => updateFuelCostsForYear(year, fuelCosts));

    await Promise.all(updatePromises);

    res.status(200).json({ message: 'Fuel costs updated for all equipment' });
  } catch (error) {
    console.error('Error updating fuel costs:', error);
    res.status(500).json({ message: 'Error updating fuel costs' });
  }
};


