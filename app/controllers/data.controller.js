const mongoose = require('mongoose');
const ObjectId = require('mongodb').ObjectId;
const Modeldata = require('../models').data;
const ExcelJS = require('exceljs');

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

exports.getAllContractors = async (req, res) => {
  try {
    // Get all collections from the database
    const collections = await mongoose.connection.db.listCollections().toArray();
  
    // Filter collections that start with "contractor-"
    const contractorCollections = collections.filter((collection) => {
      return collection.name.startsWith("contractor-");
    });

    // Extract contractor names from the collection names
    const contractors = contractorCollections.map((collection) => {
      // Assuming the name structure is "contractor-ContractorName"
      return collection.name.split('contractor-')[1];
    });

    // Send the contractor names as a response
    res.status(200).send({ contractors: contractors });
  } catch (error) {
    console.error("Error retrieving contractors:", error);
    res.status(500).send({ message: "Error retrieving contractor data" });
  }
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

exports.getModelDataByContractor = async (req, res) => {
  const contractor = req.params.contractor;
  const collectionName = `contractor-${contractor}`;

  try {
    const data = await mongoose.connection.db.collection(collectionName).find({}).toArray();
    const transformedData = data.map(equipment => transformEquipmentData(equipment));
    res.status(200).send({ contractor: contractor, data: transformedData });
  } catch (err) {
    console.error(`Error fetching model data for contractor ${contractor}:`, err);
    res.status(500).send({ message: `Error fetching model data for contractor ${contractor}` });
  }
};

const  transformEquipmentData = (equipment) => {
  const fieldsToNumber = [
    'Reimbursable', 'Fuel_type', 'Fuel_unit_price', 'Original_price', 
    'Sales_Tax', 'Discount', 'Salvage_Value', 'Current_Market_Year_Resale_Value',
    'Annual_Overhaul_Labor_Hours', 'Annual_Field_Labor_Hours', 
    'Cost_of_A_New_Set_of_Tires', 'Tire_Life_Hours', 'Hourly_Lube_Costs',
    'Hourly_Wage', 'Adjustment_for_fuel_cost', 'Horse_power',
    'Economic_Life_in_months', 'Monthly_use_hours', 'Usage_rate',
    'Initial_Freight_cost', 'Annual_Overhead_rate', 'Annual_Overhaul_Parts_cost_rate',
    'Annual_Field_Repair_Parts_and_misc_supply_parts_Cost_rate', 
    'Annual_Ground_Engaging_Component_rate', 'Cost_of_Capital_rate',
    'Depreciation_Ownership_cost_Monthly', 'Cost_of_Facilities_Capital_Ownership_cost_Monthly',
    'Overhead_Ownership_cost_Monthly', 'Overhaul_Labor_Ownership_cost_Monthly',
    'Overhaul_Parts_Ownership_cost_Monthly', 'Total_ownership_cost_hourly',
    'Field_Labor_Operating_cost_Hourly', 'Field_Parts_Operating_cost_Hourly',
    'Ground_Engaging_Component_Cost_Operating_cost_Hourly', 'Lube_Operating_cost_Hourly',
    'Fuel_by_horse_power_Operating_cost_Hourly', 'Tire_Costs_Operating_cost_Hourly',
    'Total_operating_cost', 'Total_cost_recovery'
  ];

  fieldsToNumber.forEach(field => {
    if (equipment[field] !== undefined && equipment[field] !== null) {
      // Check if the value is 'NA' or other non-desired string
      if (equipment[field] === 'NA') {
        equipment[field] = 0;
      } else {
        // Remove commas and other formatting before converting to number
        const cleanString = equipment[field].toString().replace(/,/g, '');
        let numValue = Number(cleanString);
        // Handle NaN explicitly if necessary, e.g., setting to 0
        if (isNaN(numValue)) {
          equipment[field] = 0;  // Default to 0 if the conversion does not produce a number
        } else {
          equipment[field] = Number(numValue.toFixed(2)); // Round to two decimal places and convert back to number
        }
      }
    }
});

  return equipment;
};

exports.editEquipment = async (req, res) => {
  try {
    const editedEquipment = req.body.equipment;
    const year = req.body.year;
    const contractor = req.body.contractor;

    // Determine the collection name based on whether contractor data is specified
    const collectionName = contractor ? `contractor-${contractor}` : year.toString();
    const collection = mongoose.connection.db.collection(collectionName);
    const currentYear = (await mongoose.connection.db.collection('currentyear').findOne({})).currentyear;
    const recalculatedEditedEquipment = calculateDefaultValues(editedEquipment, currentYear, year);
    const newEquipment = { ...recalculatedEditedEquipment };
    delete newEquipment._id;
    const updatedEquipment = await collection.findOneAndUpdate(
      { _id: new ObjectId(editedEquipment._id) },
      { $set: newEquipment },
      { returnDocument: 'after' }
    );

    if (!updatedEquipment) {
      return res.status(404).json({ message: 'Equipment not found' });
    }
    res.status(200).json(updatedEquipment.value); // Ensure to return the updated document
  } catch (error) {
    console.error('Error editing equipment:', error);
    res.status(500).json({ message: 'Error editing equipment' });
  }
};

exports.addNewEquipment = async (req, res) => {
  try {
    const { equipment, modelYear, contractor } = req.body;
    
    // Determine the collection name based on whether contractor data is specified
    const collectionName = contractor ? `contractor-${contractor}` : modelYear.toString();
    const collection = mongoose.connection.db.collection(collectionName);

    const currentYearDoc = await mongoose.connection.db.collection('currentyear').findOne({});
    const latestYear = currentYearDoc.currentyear;

    const calculatedEquipment = calculateDefaultValues(equipment, latestYear, modelYear);
    await collection.insertOne(calculatedEquipment);

    res.status(201).send({ message: "Equipment added successfully", data: calculatedEquipment });
  } catch (error) {
    console.error("Error adding new equipment:", error);
    res.status(500).send({ message: "Error adding new equipment" });
  }
};


exports.generateNextYearEquipData = async (req, res) => {
  try {
      const currentYearData = await mongoose.connection.db.collection('currentyear').findOne({});
      const currentYear = currentYearData ? currentYearData.currentyear : (new Date().getFullYear()).toString();
      const currentDate = new Date();
      const actualCurrentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth();
      if (currentYear < actualCurrentYear || (currentYear === actualCurrentYear && currentMonth === 11)){
        
        const { priceIncreaseRate, dataUpdate } = req.body;
        const currentYearCollection = mongoose.connection.db.collection(currentYear.toString());
        const currentYearEquipmentData = await currentYearCollection.find({}).toArray();
        const nextYear = (parseInt(currentYear) + 1).toString();
        const nextYearCollectionForCheck = mongoose.connection.db.collection(nextYear);
        const existingData = await nextYearCollectionForCheck.find({}).toArray();
        if (existingData.length > 0) {
            return res.status(409).json({ message: `Equipment data for year ${nextYear} already exists` });
        }
        const nextYearEquipmentData = currentYearEquipmentData.map(equipment => {
            const nextYrEquipment = { ...equipment };
            nextYrEquipment.Original_price = Math.round(equipment.Original_price * (1 + priceIncreaseRate / 100));
            return calculateDefaultValues(nextYrEquipment, nextYear, nextYear);
        });
        // console.log(`Created year ${nextYear} data`);
        // console.log(nextYearEquipmentData)
        await mongoose.connection.db.collection(nextYear).insertMany(nextYearEquipmentData);
        await mongoose.connection.db.collection('currentyear').updateOne({}, { $set: { currentyear: parseInt(nextYear) } });
        const updatePromises = [];
        if (dataUpdate) {
          for (let year = currentYear; year >= 2003; year--) {
            updatePromises.push(updateYearEquipmentData(nextYear, year));
        }
        await Promise.all(updatePromises);
        res.status(200).json({ message: `Equipment data for year ${nextYear} generated and previous years updated successfully` });
    
        } else {
          res.status(200).json({ message: `Equipment data for year ${nextYear} generated successfully` });
        }
        } else {
          return res.status(400).json({ message: 'Data generation is only allowed in December.' });
        }} catch (error) {
        console.error('Error generating next year equipment data:', error);
        res.status(500).json({ message: 'Error generating next year equipment data' });
      }

  };

async function updateYearEquipmentData(year, currYear) {
  const yearCollection = mongoose.connection.db.collection(currYear.toString());
  const equipmentsForYear = await yearCollection.find({}).toArray();
  const operations = equipmentsForYear.map(equipment => {
      const updatedEquipment = calculateDefaultValues(equipment, year, currYear);
      // console.log(`Model year ${currYear} updated data`);
      // console.log(updatedEquipment);
      return {
          updateOne: {
              filter: { _id: updatedEquipment._id },
              update: { $set: updatedEquipment }
          }
      };
  });
  if (operations.length) {
      return yearCollection.bulkWrite(operations, { ordered: false });
  }
};


const calculateDefaultValues = (equipment, latestYear, ModelYear) => {
  if (!equipment) return; 
  equipment = transformEquipmentData(equipment);
  const denominator = (equipment.Economic_Life_in_months / 12);
  equipment.Current_Market_Year_Resale_Value = Math.round(
    denominator ?
        Math.max(
            equipment.Original_price - ((latestYear - ModelYear) * equipment.Original_price * (1 - equipment.Salvage_Value)) / denominator,
            equipment.Original_price * equipment.Salvage_Value
        )
        : 0
  );
  equipment.Usage_rate = Number(Number((equipment.Monthly_use_hours / 176)).toFixed(3));

  const fuelType = equipment['Reimbursable Fuel_type (1 diesel, 2 gas, 3 other)'] || 0;
  const fuelMultiplier = (Math.abs(fuelType - 1) < 0.0001) ? 0.04 : (Math.abs(fuelType - 2) < 0.0001) ? 0.06 : 0;
  //taking the latest fuel unit price 
  const fuelCostsDoc =  mongoose.connection.db.collection('fuelcosts').findOne({});
    // Determine the fuel type and set the unit price accordingly
  switch(equipment['Reimbursable Fuel_type (1 diesel, 2 gas, 3 other)']) {
      case 1: // Diesel
        equipment.Fuel_unit_price = fuelCostsDoc.diesel_price;
        break;
      case 2: // Gasoline
        equipment.Fuel_unit_price = fuelCostsDoc.gasoline_price;
        break;
      case 3: // Other
        equipment.Fuel_unit_price = fuelCostsDoc.other;
        break;
      default:
        // Set a default or throw an error if needed
        break;
    }
  equipment.Tire_Costs_Operating_cost_Hourly = (equipment.Cost_of_A_New_Set_of_Tires && equipment.Tire_Life_Hours) ? equipment.Cost_of_A_New_Set_of_Tires / equipment.Tire_Life_Hours : 0;

  equipment.Lube_Operating_cost_Hourly = equipment.Lube_Operating_cost_Hourly || 0;

  equipment.Depreciation_Ownership_cost_Monthly = (equipment.Original_price * (1 + equipment.Sales_Tax) * (1 - equipment.Discount) * (1 - equipment.Salvage_Value) + (equipment.Initial_Freight_cost * equipment.Original_price)) / equipment.Economic_Life_in_months / equipment.Usage_rate;
  equipment.Cost_of_Facilities_Capital_Ownership_cost_Monthly = equipment.Cost_of_Capital_rate * equipment.Original_price / 12 / equipment.Usage_rate;
  equipment.Overhead_Ownership_cost_Monthly = equipment.Annual_Overhead_rate * equipment.Current_Market_Year_Resale_Value / 12 / equipment.Usage_rate;
  equipment.Overhaul_Labor_Ownership_cost_Monthly = equipment.Hourly_Wage * equipment.Annual_Overhaul_Labor_Hours / 12 / equipment.Usage_rate;
  equipment.Overhaul_Parts_Ownership_cost_Monthly = equipment.Annual_Overhaul_Parts_cost_rate * equipment.Original_price / 12 / equipment.Usage_rate;
  
  equipment.Total_ownership_cost_hourly = (equipment.Depreciation_Ownership_cost_Monthly + equipment.Cost_of_Facilities_Capital_Ownership_cost_Monthly + equipment.Overhead_Ownership_cost_Monthly + equipment.Overhaul_Labor_Ownership_cost_Monthly + equipment.Overhaul_Parts_Ownership_cost_Monthly) / 176;
  equipment.Field_Labor_Operating_cost_Hourly = equipment.Annual_Field_Labor_Hours * equipment.Hourly_Wage / 12 / equipment.Monthly_use_hours;
  equipment.Field_Parts_Operating_cost_Hourly = equipment.Annual_Field_Repair_Parts_and_misc_supply_parts_Cost_rate * equipment.Original_price / 12 / equipment.Monthly_use_hours;
  equipment.Ground_Engaging_Component_Cost_Operating_cost_Hourly = equipment.Annual_Ground_Engaging_Component_rate * equipment.Original_price / 12 / equipment.Monthly_use_hours;
  equipment.Fuel_by_horse_power_Operating_cost_Hourly = fuelMultiplier * equipment.Horse_power * equipment.Fuel_unit_price;

  equipment.Total_operating_cost = equipment.Field_Labor_Operating_cost_Hourly + equipment.Field_Parts_Operating_cost_Hourly + equipment.Ground_Engaging_Component_Cost_Operating_cost_Hourly + equipment.Lube_Operating_cost_Hourly + equipment.Fuel_by_horse_power_Operating_cost_Hourly + equipment.Tire_Costs_Operating_cost_Hourly;
  equipment.Total_cost_recovery = equipment.Total_ownership_cost_hourly + equipment.Total_operating_cost;
  // console.log(`Year ${ModelYear} data`)
  // console.log(equipment)
  return equipment;
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

exports.getLabourWage = async (req, res) => {
  try {
    const wageCostsCollection = mongoose.connection.db.collection('wagecosts');
    const wageCosts = await wageCostsCollection.findOne({});

    if (!wageCosts) {
      return res.status(404).json({ message: 'wage costs not found' });
    }

    res.status(200).json({ wageCosts });
  } catch (error) {
    console.error('Error fetching wage costs:', error);
    res.status(500).json({ message: 'Error fetching wage costs' });
  }
};

exports.getCurrentYear = async (req, res) => {
  try {
    const currentYearCollection = mongoose.connection.db.collection('currentyear');
    const currentYear = await currentYearCollection.findOne({});

    if (!currentYear) {
      return res.status(404).json({ message: 'current year not found' });
    }

    res.status(200).json({ currentYear });
  } catch (error) {
    console.error('Error fetching current year:', error);
    res.status(500).json({ message: 'Error fetching current year' });
  }
};

async function getAllRelevantCollections() {
  const collections = await mongoose.connection.db.listCollections().toArray();
  const yearCollections = [];
  const contractorCollections = [];

  collections.forEach(collection => {
      if (!isNaN(parseInt(collection.name))) {
          yearCollections.push(collection.name);
      } else if (collection.name.startsWith("contractor-")) {
          contractorCollections.push(collection.name);
      }
  });

  return { yearCollections, contractorCollections };
}

// Old version when we have only equipments

// const updateFuelCostsForYear = async (year, fuelCosts) => {
//   const equipmentCollection = mongoose.connection.db.collection(year);

//   const equipmentData = await equipmentCollection.find({}).toArray();

//   const updatedEquipmentData = equipmentData.map((equipment) => {
//     let fuelUnitPrice;
//     const fuelType = parseInt(equipment['Reimbursable Fuel_type (1 diesel, 2 gas, 3 other)']);
//     if ( fuelType === 1) {
//       fuelUnitPrice = fuelCosts.diesel_price;
//     } else if (fuelType === 2) {
//       fuelUnitPrice = fuelCosts.gasoline_price;
//     } else {
//       fuelUnitPrice = fuelCosts.other;
//     }

//     equipment.Fuel_unit_price = fuelUnitPrice;
//     equipment.Fuel_by_horse_power_Operating_cost_Hourly =
//       (fuelType === 1 ? 0.04 :
//         fuelType === 2 ? 0.06 : 0) *
//       equipment.Horse_power * fuelUnitPrice;
//     equipment.Total_operating_cost = equipment.Field_Labor_Operating_cost_Hourly + equipment.Field_Parts_Operating_cost_Hourly + equipment.Ground_Engaging_Component_Cost_Operating_cost_Hourly + equipment.Lube_Operating_cost_Hourly + equipment.Fuel_by_horse_power_Operating_cost_Hourly + equipment.Tire_Costs_Operating_cost_Hourly;
//     equipment.Total_cost_recovery = equipment.Total_ownership_cost_hourly + equipment.Total_operating_cost;
//     return equipment;
//   });

//   const updatePromises = updatedEquipmentData.map((equipment) =>
//     equipmentCollection.updateOne({ _id: equipment._id }, { $set: equipment })
//   );

//   await Promise.all(updatePromises);
// };

const updateFuelCostsForCollection = async (collectionName, fuelCosts) => {
  const equipmentCollection = mongoose.connection.db.collection(collectionName);
  const equipmentData = await equipmentCollection.find({}).toArray();
  // The same update logic as before
  const updatedEquipmentData = equipmentData.map((equipment) => {
    equipment = transformEquipmentData(equipment);
    let fuelUnitPrice;
    const fuelType = parseInt(equipment['Reimbursable Fuel_type (1 diesel, 2 gas, 3 other)']);
    if ( fuelType === 1) {
      fuelUnitPrice = fuelCosts.diesel_price;
    } else if (fuelType === 2) {
      fuelUnitPrice = fuelCosts.gasoline_price;
    } else {
      fuelUnitPrice = fuelCosts.other;
    }

    equipment.Fuel_unit_price = fuelUnitPrice;
    equipment.Fuel_by_horse_power_Operating_cost_Hourly =
      (fuelType === 1 ? 0.04 :
        fuelType === 2 ? 0.06 : 0) *
      equipment.Horse_power * fuelUnitPrice;
    equipment.Total_operating_cost = equipment.Field_Labor_Operating_cost_Hourly + equipment.Field_Parts_Operating_cost_Hourly + equipment.Ground_Engaging_Component_Cost_Operating_cost_Hourly + equipment.Lube_Operating_cost_Hourly + equipment.Fuel_by_horse_power_Operating_cost_Hourly + equipment.Tire_Costs_Operating_cost_Hourly;
    equipment.Total_cost_recovery = equipment.Total_ownership_cost_hourly + equipment.Total_operating_cost;
    return equipment;
  });

  const updatePromises = updatedEquipmentData.map((equipment) =>
    equipmentCollection.updateOne({ _id: equipment._id }, { $set: equipment })
  );

  await Promise.all(updatePromises);
};

// Old version when we have only equipments
// exports.editFuelCosts = async (req, res) => {
//   try {
//     const fuelCosts = req.body;

//     const fuelCostsCollection = mongoose.connection.db.collection('fuelcosts');
//     await fuelCostsCollection.updateOne({}, { $set: fuelCosts }, { upsert: true });

//     const equipmentCollections = await mongoose.connection.db.listCollections().toArray();
//     const yearCollections = equipmentCollections
//       .filter((collection) => !isNaN(parseInt(collection.name)))
//       .map((collection) => collection.name)
//       .sort();

//     const updatePromises = yearCollections.map((year) => updateFuelCostsForYear(year, fuelCosts));

//     await Promise.all(updatePromises);

//     res.status(200).json({ message: 'Fuel costs updated for all equipment' });
//   } catch (error) {
//     console.error('Error updating fuel costs:', error);
//     res.status(500).json({ message: 'Error updating fuel costs' });
//   }
// };

exports.editFuelCosts = async (req, res) => {
  try {
    const fuelCosts = req.body;

    // Update the global fuel costs settings
    const fuelCostsCollection = mongoose.connection.db.collection('fuelcosts');
    await fuelCostsCollection.updateOne({}, { $set: fuelCosts }, { upsert: true });

    const { yearCollections, contractorCollections } = await getAllRelevantCollections();

    // Update fuel costs for both year and contractor collections
    const updatePromises = [...yearCollections, ...contractorCollections].map((collectionName) =>
      updateFuelCostsForCollection(collectionName, fuelCosts)
    );

    await Promise.all(updatePromises);

    res.status(200).json({ message: 'Fuel costs updated for all equipment' });
  } catch (error) {
    console.error('Error updating fuel costs:', error);
    res.status(500).json({ message: 'Error updating fuel costs' });
  }
};

exports.updateHourlyWage = async (req, res) => {
  try {
    const hourlyWage = req.body.hourly_wage;

    const hourlyWageCollection = mongoose.connection.db.collection('wagecosts');
    await hourlyWageCollection.updateOne({}, { $set: { hourly_wage: hourlyWage } }, { upsert: true });

    const { yearCollections, contractorCollections } = await getAllRelevantCollections();

    const updatePromises = [...yearCollections, ...contractorCollections].map((collectionName) =>
      updateHourlyWageForCollection(collectionName, hourlyWage)
    );

    await Promise.all(updatePromises);

    res.status(200).json({ message: 'Hourly wage updated for all equipment' });
  } catch (error) {
    console.error('Error updating hourly wage:', error);
    res.status(500).json({ message: 'Error updating hourly wage' });
  }
};

const updateHourlyWageForCollection = async (collectionName, hourlyWage) => {
  const equipmentCollection = mongoose.connection.db.collection(collectionName);
  const equipmentData = await equipmentCollection.find({}).toArray();
  // The same update logic as before
  const updatedEquipmentData = equipmentData.map((equipment) => {
    equipment = transformEquipmentData(equipment);
    equipment.Hourly_Wage = hourlyWage;
    // Recalculate the costs based on the updated hourly wage
    equipment.Overhaul_Labor_Ownership_cost_Monthly = (equipment.Hourly_Wage * equipment.Annual_Overhaul_Labor_Hours) / 12 / equipment.Usage_rate;
    equipment.Total_ownership_cost_hourly = (equipment.Depreciation_Ownership_cost_Monthly + equipment.Cost_of_Facilities_Capital_Ownership_cost_Monthly + equipment.Overhead_Ownership_cost_Monthly + equipment.Overhaul_Labor_Ownership_cost_Monthly + equipment.Overhaul_Parts_Ownership_cost_Monthly) / 176;
    equipment.Field_Labor_Operating_cost_Hourly = (equipment.Annual_Field_Labor_Hours * equipment.Hourly_Wage) / 12 / equipment.Monthly_use_hours;
    equipment.Total_operating_cost = equipment.Field_Labor_Operating_cost_Hourly + equipment.Field_Parts_Operating_cost_Hourly + equipment.Ground_Engaging_Component_Cost_Operating_cost_Hourly + equipment.Lube_Operating_cost_Hourly + equipment.Fuel_by_horse_power_Operating_cost_Hourly + equipment.Tire_Costs_Operating_cost_Hourly;
    equipment.Total_cost_recovery = equipment.Total_ownership_cost_hourly + equipment.Total_operating_cost;
    return equipment;
  });

  const updatePromises = updatedEquipmentData.map((equipment) =>
    equipmentCollection.updateOne({ _id: equipment._id }, { $set: equipment })
  );

  await Promise.all(updatePromises);
};


// Old version when we have only equipments

// exports.updateHourlyWage = async (req, res) => {
//   try {
//     console.log(req.body);
//     const hourlyWage = req.body.hourly_wage;  // Assuming hourly wage is sent in the request body

//     // Update the hourly wage in the 'wagecosts' collection
//     const hourlyWageCollection = mongoose.connection.db.collection('wagecosts');
//     await hourlyWageCollection.updateOne({}, { $set: { hourly_wage: hourlyWage } }, { upsert: true });

//     // Update hourly wage and calculate costs for all equipment data
//     const equipmentCollections = await mongoose.connection.db.listCollections().toArray();
//     const yearCollections = equipmentCollections
//       .filter((collection) => !isNaN(parseInt(collection.name)))
//       .map((collection) => collection.name)
//       .sort();

//     const updatePromises = yearCollections.map((year) => updateHourlyWageAndCalculateCosts(year, hourlyWage));

//     await Promise.all(updatePromises);

//     res.status(200).json({ message: 'Hourly wage and related costs updated for all equipment' });
//   } catch (error) {
//     console.error('Error updating hourly wage and related costs:', error);
//     res.status(500).json({ message: 'Error updating hourly wage and related costs' });
//   }
// };

// const updateHourlyWageAndCalculateCosts = async (year, hourlyWage) => {
//   const equipmentCollection = mongoose.connection.db.collection(year);

//   const equipmentData = await equipmentCollection.find({}).toArray();

//   const updatedEquipmentData = equipmentData.map((equipment) => {
//     equipment.Hourly_Wage = hourlyWage;
//     // Recalculate the costs based on the updated hourly wage
//     equipment.Overhaul_Labor_Ownership_cost_Monthly = (equipment.Hourly_Wage * equipment.Annual_Overhaul_Labor_Hours) / 12 / equipment.Usage_rate;
//     equipment.Total_ownership_cost_hourly = (equipment.Depreciation_Ownership_cost_Monthly + equipment.Cost_of_Facilities_Capital_Ownership_cost_Monthly + equipment.Overhead_Ownership_cost_Monthly + equipment.Overhaul_Labor_Ownership_cost_Monthly + equipment.Overhaul_Parts_Ownership_cost_Monthly) / 176;
//     equipment.Field_Labor_Operating_cost_Hourly = (equipment.Annual_Field_Labor_Hours * equipment.Hourly_Wage) / 12 / equipment.Monthly_use_hours;
//     equipment.Total_operating_cost = equipment.Field_Labor_Operating_cost_Hourly + equipment.Field_Parts_Operating_cost_Hourly + equipment.Ground_Engaging_Component_Cost_Operating_cost_Hourly + equipment.Lube_Operating_cost_Hourly + equipment.Fuel_by_horse_power_Operating_cost_Hourly + equipment.Tire_Costs_Operating_cost_Hourly;
//     equipment.Total_cost_recovery = equipment.Total_ownership_cost_hourly + equipment.Total_operating_cost;
//     return equipment;
//   });

//   const updatePromises = updatedEquipmentData.map((equipment) =>
//     equipmentCollection.updateOne({ _id: equipment._id }, { $set: equipment })
//   );

//   await Promise.all(updatePromises);
// };

exports.exportEquipmentData = async (req, res) => {
  try {
    const selections = req.body.selections; // An array of years
    const dataType = req.body.dataType;
    const workbook = new ExcelJS.Workbook(); // Create a new workbook

    for (const selection of selections) {
      const collectionName = dataType === 'contractors' ? `contractor-${selection}` : selection.toString();
      const data = await mongoose.connection.db.collection(collectionName).find({}).toArray(); // Fetch data for each selection
        if (data.length === 0) {
            continue; // If no data, skip this year
        }
        const worksheet = workbook.addWorksheet(selection.toString()); // Create a new worksheet for each year
        
        const columns = Object.keys(data[0])
          .filter(key => key !== '_id')
          .map(key => ({
            header: key,
            key: key,
            width: key.length + 10 // Set width based on key length for better visibility
          }));
        // Automatically set columns based on keys of the first object in the data array

        worksheet.columns = columns;

        const filteredData = data.map(item => {
          const { _id, ...rest } = item;
          return rest;
        });
        worksheet.addRows(filteredData);
    }

    // Set response headers to prompt download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="EquipmentData.xlsx"');

    // Write workbook to the HTTP response
    await workbook.xlsx.write(res);

    res.status(200).end(); // End the response process
} catch (error) {
    res.status(500).send({ message: "Error exporting data", error: error.message });
}
};




